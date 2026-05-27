import { useState } from "react";
import { useAtomValue } from "jotai";
import * as Popover from "@radix-ui/react-popover";
import * as Slider from "@radix-ui/react-slider";
import { useTranslate } from "src/hooks/use-translate";
import { currentZoomAtom } from "src/state/map";
import { nodeSymbologyAtom } from "src/state/map-symbology";
import { strokeColorFor } from "src/lib/color";
import { SelectorLikeButton } from "src/components/form/selector-trigger";
import { InlineField } from "src/components/form/fields";
import * as E from "src/components/elements";

// Mirrors the map's zoom range (see MAP_OPTIONS.maxZoom in src/map/map-engine.ts).
// Kept local while this component is UI-only; lifts to shared config when wired.
const MAP_MIN_ZOOM = 0;
const MAP_MAX_ZOOM = 26;

// Defaults match today's hardcoded junctionCircleSizes() interpolation
// (src/map/layers/junctions.ts): 0.5px at zoom 12 → 5px at the max zoom.
const DEFAULT_MIN_VISIBLE_ZOOM = 12;
const DEFAULT_MIN_SIZE = 0.5;
const DEFAULT_MAX_SIZE = 5;

const SIZE_SLIDER_MIN = 0.5;
const SIZE_SLIDER_MAX = 20;
const SIZE_SLIDER_STEP = 0.5;

// Radix insets each thumb by half its width (w-2.5 → 5px) so it never overflows
// the track; the thumb center therefore travels 5px in from each track edge.
const THUMB_HALF_WIDTH = 5;
// Inset the preview/caret rows by the largest possible circle radius (plus a
// little whitespace) so a max-size circle stays inside the popover, and inset
// the track 5px less so its thumb-center travel lines up with those rows.
const PREVIEW_EDGE_INSET = SIZE_SLIDER_MAX + 4;
const TRACK_EDGE_INSET = PREVIEW_EDGE_INSET - THUMB_HALF_WIDTH;

const toPct = (value: number) =>
  ((value - MAP_MIN_ZOOM) / (MAP_MAX_ZOOM - MAP_MIN_ZOOM)) * 100;

const clampPct = (pct: number) => Math.min(100, Math.max(0, pct));

const PreviewCircle = ({
  radiusPx,
  color,
  strokeColor,
  style,
}: {
  radiusPx: number;
  color: string;
  strokeColor: string;
  style: React.CSSProperties;
}) => {
  const diameter = Math.max(2, radiusPx * 2);
  return (
    <div
      aria-hidden
      className="absolute bottom-0 rounded-full border"
      style={{
        width: diameter,
        height: diameter,
        backgroundColor: color,
        borderColor: strokeColor,
        ...style,
      }}
    />
  );
};

const SizeSlider = ({
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}) => (
  <div className="flex items-center gap-2">
    <Slider.Root
      className="relative flex items-center grow h-4 select-none touch-none"
      min={SIZE_SLIDER_MIN}
      max={SIZE_SLIDER_MAX}
      step={SIZE_SLIDER_STEP}
      value={[value]}
      onValueChange={([next]) => onChange(next)}
      disabled={disabled}
    >
      <Slider.Track className="relative grow rounded-full h-1.5 bg-gray-200 dark:bg-gray-700">
        <Slider.Range className="absolute h-full rounded-full bg-purple-400 dark:bg-purple-500" />
      </Slider.Track>
      <Slider.Thumb
        aria-label={ariaLabel}
        className="block w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-500 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 cursor-pointer"
      />
    </Slider.Root>
    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-10 text-right shrink-0">
      {value}px
    </span>
  </div>
);

export function NodeSizePopover({ readonly = false }: { readonly?: boolean }) {
  const translate = useTranslate();
  const nodeColor = useAtomValue(nodeSymbologyAtom).defaults.color;
  const strokeColor = strokeColorFor(nodeColor);
  // Read-only indicator of the map's current zoom; map → atom wiring exists,
  // atom → map does not yet, so dragging it back is deferred (UI-only scope).
  const currentZoom = useAtomValue(currentZoomAtom);

  const [minVisibleZoom, setMinVisibleZoom] = useState(
    DEFAULT_MIN_VISIBLE_ZOOM,
  );
  const [minSize, setMinSize] = useState(DEFAULT_MIN_SIZE);
  const [maxSize, setMaxSize] = useState(DEFAULT_MAX_SIZE);

  const minThumbPct = clampPct(toPct(minVisibleZoom));
  const currentZoomPct = clampPct(toPct(currentZoom));

  return (
    <Popover.Root>
      <Popover.Trigger asChild disabled={readonly}>
        <SelectorLikeButton ariaLabel={translate("nodeSize.label")}>
          {translate("nodeSize.summary", String(minSize), String(maxSize))}
        </SelectorLikeButton>
      </Popover.Trigger>
      <E.PopoverContent2
        size="sm"
        side="right"
        align="start"
        sideOffset={94}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-4">
          {/* Zoom range block */}
          <div>
            {/* Size-preview circles above the track. Inset so left:0%–100% maps
                onto the thumb-center travel (keeping circles aligned with the
                thumbs/markers below) and a max-size circle stays in the popover. */}
            <div
              className="relative h-12"
              style={{
                marginLeft: PREVIEW_EDGE_INSET,
                marginRight: PREVIEW_EDGE_INSET,
              }}
            >
              <PreviewCircle
                radiusPx={minSize}
                color={nodeColor}
                strokeColor={strokeColor}
                style={{
                  left: `${minThumbPct}%`,
                  transform: "translateX(-50%)",
                }}
              />
              <PreviewCircle
                radiusPx={maxSize}
                color={nodeColor}
                strokeColor={strokeColor}
                style={{ left: "100%", transform: "translateX(-50%)" }}
              />
            </div>

            {/* Track + draggable min-zoom thumb + pinned max marker */}
            <div
              className="relative"
              style={{
                marginLeft: TRACK_EDGE_INSET,
                marginRight: TRACK_EDGE_INSET,
              }}
            >
              <Slider.Root
                className="relative flex items-center w-full h-4 select-none touch-none"
                min={MAP_MIN_ZOOM}
                max={MAP_MAX_ZOOM}
                step={0.5}
                value={[minVisibleZoom]}
                onValueChange={([next]) => setMinVisibleZoom(next)}
                disabled={readonly}
              >
                {/* Track background = visible zooms (solid) */}
                <Slider.Track className="relative grow rounded-full h-2 bg-purple-200 dark:bg-purple-900">
                  {/* Range (0 → thumb) = hidden zooms (hatched) */}
                  <Slider.Range
                    className="absolute h-full rounded-l-full bg-gray-200 dark:bg-gray-700"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, #94a3b8 0, #94a3b8 1px, transparent 1px, transparent 4px)",
                    }}
                  />
                </Slider.Track>
                <Slider.Thumb
                  aria-label={translate("nodeSize.minZoomAriaLabel")}
                  className="block w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 cursor-pointer"
                />
              </Slider.Root>
              {/* Non-interactive max-zoom marker pinned at the right edge */}
              <div
                role="img"
                aria-label={translate("nodeSize.maxZoomAriaLabel")}
                className="absolute top-1/2 right-0 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500 pointer-events-none"
              />
            </div>

            {/* Current-map-zoom indicator below the track (same inset as previews) */}
            <div
              className="relative h-3 mt-0.5"
              style={{
                marginLeft: PREVIEW_EDGE_INSET,
                marginRight: PREVIEW_EDGE_INSET,
              }}
            >
              <div
                role="img"
                aria-label={translate("nodeSize.currentZoomAriaLabel")}
                className="absolute top-0"
                style={{
                  left: `${currentZoomPct}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "4px solid transparent",
                    borderRight: "4px solid transparent",
                    borderBottom: "5px solid #64748b",
                  }}
                />
              </div>
            </div>
          </div>

          <InlineField
            name={translate("nodeSize.minSize")}
            layout="fixed-label"
            labelSize="sm"
          >
            <SizeSlider
              value={minSize}
              onChange={setMinSize}
              ariaLabel={translate("nodeSize.minSizeAriaLabel")}
              disabled={readonly}
            />
          </InlineField>

          <InlineField
            name={translate("nodeSize.maxSize")}
            layout="fixed-label"
            labelSize="sm"
          >
            <SizeSlider
              value={maxSize}
              onChange={setMaxSize}
              ariaLabel={translate("nodeSize.maxSizeAriaLabel")}
              disabled={readonly}
            />
          </InlineField>
        </div>
      </E.PopoverContent2>
    </Popover.Root>
  );
}
