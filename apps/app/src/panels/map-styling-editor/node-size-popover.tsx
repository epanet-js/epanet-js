import { useContext, useId, useRef } from "react";
import { useAtomValue } from "jotai";
import * as Popover from "@radix-ui/react-popover";
import * as Slider from "@radix-ui/react-slider";
import { useTranslate } from "src/hooks/use-translate";
import { MapContext } from "src/map";
import { currentZoomAtom } from "src/state/map";
import { nodeSymbologyAtom } from "src/state/map-symbology";
import { strokeColorFor } from "src/lib/color";
import { SelectorLikeButton } from "src/components/form/selector-trigger";
import * as E from "src/components/elements";
import type { NodeSizeConfig } from "src/map/symbology/symbology-types";
import { MAP_MIN_ZOOM, MAP_MAX_ZOOM, MAX_MIN_VISIBLE_ZOOM } from "./node-size";

const SIZE_SLIDER_MIN = 1;
const SIZE_SLIDER_MAX = 20;
const SIZE_SLIDER_STEP = 1;

export function NodeSizePopover({
  value,
  onChange,
  readonly = false,
}: {
  value: NodeSizeConfig;
  onChange: (value: NodeSizeConfig) => void;
  readonly?: boolean;
}) {
  const translate = useTranslate();
  const nodeColor = useAtomValue(nodeSymbologyAtom).defaults.color;
  const strokeColor = strokeColorFor(nodeColor);

  const minSizeId = useId();
  const maxSizeId = useId();
  const zoomId = useId();

  const { minVisibleZoom, minSize, maxSize } = value;

  return (
    <Popover.Root>
      <Popover.Trigger asChild disabled={readonly}>
        <SelectorLikeButton
          ariaLabel={`${translate("nodeSize.label")}: ${translate(
            "nodeSize.summary",
            String(minSize),
            String(maxSize),
          )}`}
        >
          {translate("nodeSize.summary", String(minSize), String(maxSize))}
        </SelectorLikeButton>
      </Popover.Trigger>
      <E.PopoverContent2
        size="sm"
        side="right"
        align="start"
        sideOffset={94}
        onOpenAutoFocus={(e) => e.preventDefault()}
        aria-label={translate("nodeSize.label")}
      >
        <div className="space-y-1">
          <h3 className="pb-1 font-semibold text-sm">
            {translate("nodeSize.label")}
          </h3>

          <div className="flex items-center gap-2">
            <label
              htmlFor={minSizeId}
              className="w-10 text-sm text-gray-500 min-w-0 shrink-0 wrap-break-word"
            >
              {translate("nodeSize.minSize")}
            </label>
            <SizeSlider
              id={minSizeId}
              value={minSize}
              onChange={(next) => onChange({ ...value, minSize: next })}
              ariaLabel={translate("nodeSize.minSizeAriaLabel")}
              disabled={readonly}
            />
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor={maxSizeId}
              className="w-10 text-sm text-gray-500 min-w-0 shrink-0 wrap-break-word"
            >
              {translate("nodeSize.maxSize")}
            </label>
            <SizeSlider
              id={maxSizeId}
              value={maxSize}
              onChange={(next) => onChange({ ...value, maxSize: next })}
              ariaLabel={translate("nodeSize.maxSizeAriaLabel")}
              disabled={readonly}
            />
          </div>
          <div className="flex gap-2">
            <label
              htmlFor={zoomId}
              className="w-10 pt-[6px] text-sm text-gray-500 min-w-0 shrink-0 wrap-break-word"
            >
              {translate("nodeSize.zoom")}
            </label>
            <ZoomRangeSlider
              id={zoomId}
              minVisibleZoom={minVisibleZoom}
              minSize={minSize}
              maxSize={maxSize}
              onMinVisibleZoomChange={(next) =>
                onChange({ ...value, minVisibleZoom: next })
              }
              nodeColor={nodeColor}
              strokeColor={strokeColor}
              disabled={readonly}
            />
          </div>
        </div>
      </E.PopoverContent2>
    </Popover.Root>
  );
}

const toPct = (value: number) =>
  Math.min(
    100,
    Math.max(0, ((value - MAP_MIN_ZOOM) / (MAP_MAX_ZOOM - MAP_MIN_ZOOM)) * 100),
  );

const PreviewCircle = ({
  radiusPx,
  color,
  strokeColor,
  sliderPct,
}: {
  radiusPx: number;
  color: string;
  strokeColor: string;
  sliderPct: number;
}) => {
  const diameter = Math.max(2, radiusPx * 2);
  return (
    <div
      aria-hidden
      className="absolute top-0 -translate-x-1/2 rounded-full border"
      style={{
        width: diameter,
        height: diameter,
        backgroundColor: color,
        borderColor: strokeColor,
        left: `${sliderPct}%`,
      }}
    />
  );
};

const CurrentZoomIndicator = ({
  id,
  min,
  max,
}: {
  id?: string;
  min: number;
  max: number;
}) => {
  const translate = useTranslate();
  const map = useContext(MapContext);
  const zoom = useAtomValue(currentZoomAtom);
  const ariaLabel = translate("nodeSize.currentZoomAriaLabel");
  const disabled = !map;
  const minNavigable = map?.getNavigableMinZoom() ?? min;
  const onChange = (z: number) => map?.map.setZoom(z);
  const rowRef = useRef<HTMLDivElement>(null);

  const zoomFromPointer = (e: React.PointerEvent<HTMLDivElement>): number => {
    const row = rowRef.current;
    if (!row) return zoom;
    const rect = row.getBoundingClientRect();
    const fraction = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    return min + fraction * (max - min);
  };

  const clampToRange = (z: number) => Math.min(max, Math.max(minNavigable, z));

  const pct = Math.min(100, Math.max(0, ((zoom - min) / (max - min)) * 100));

  return (
    <div
      id={id}
      ref={rowRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={zoom}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className="relative h-2 ml-2 mr-8 cursor-ew-resize touch-none rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(clampToRange(zoomFromPointer(e)));
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        onChange(clampToRange(zoomFromPointer(e)));
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        const step = e.shiftKey ? 1 : 0.5;
        let next: number | null = null;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = zoom - step;
        else if (e.key === "ArrowRight" || e.key === "ArrowUp")
          next = zoom + step;
        else if (e.key === "Home") next = minNavigable;
        else if (e.key === "End") next = max;
        else if (e.key === "PageDown") next = zoom - step * 5;
        else if (e.key === "PageUp") next = zoom + step * 5;
        if (next === null) return;
        e.preventDefault();
        onChange(clampToRange(next));
      }}
    >
      <div
        aria-hidden
        className="absolute bottom-0 -translate-x-1/2"
        style={{ left: `${pct}%` }}
      >
        <div className="w-0 h-0 border-x-[6px] border-x-transparent border-t-8 border-t-slate-500" />
      </div>
    </div>
  );
};

const ZoomRangeSlider = ({
  id,
  minVisibleZoom,
  minSize,
  maxSize,
  onMinVisibleZoomChange,
  nodeColor,
  strokeColor,
  disabled,
}: {
  id?: string;
  minVisibleZoom: number;
  minSize: number;
  maxSize: number;
  onMinVisibleZoomChange: (next: number) => void;
  nodeColor: string;
  strokeColor: string;
  disabled?: boolean;
}) => {
  const translate = useTranslate();
  const minThumbPct = toPct(minVisibleZoom);

  return (
    <div className="flex-1">
      <CurrentZoomIndicator id={id} min={MAP_MIN_ZOOM} max={MAP_MAX_ZOOM} />

      <div className="relative mr-6">
        <Slider.Root
          className="relative flex items-center w-full h-4 select-none touch-none"
          min={MAP_MIN_ZOOM}
          max={MAP_MAX_ZOOM}
          step={0.5}
          value={[minVisibleZoom]}
          onValueChange={([next]) =>
            onMinVisibleZoomChange(Math.min(next, MAX_MIN_VISIBLE_ZOOM))
          }
          disabled={disabled}
        >
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
            className="block w-4 h-4 rounded-full bg-white border-2 border-purple-500 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 cursor-pointer"
          />
        </Slider.Root>
        <div
          aria-hidden
          className="absolute top-1/2 right-0 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-gray-300 dark:border-gray-500 pointer-events-none"
        />
      </div>

      <div className="relative h-10 mt-1 ml-2 mr-8">
        <PreviewCircle
          radiusPx={minSize}
          color={nodeColor}
          strokeColor={strokeColor}
          sliderPct={minThumbPct}
        />
        <PreviewCircle
          radiusPx={maxSize}
          color={nodeColor}
          strokeColor={strokeColor}
          sliderPct={100}
        />
      </div>
    </div>
  );
};

const SizeSlider = ({
  id,
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}) => (
  <div className="flex flex-1 items-center gap-2 h-8">
    <Slider.Root
      className="relative flex items-center grow h-8 select-none touch-none"
      min={SIZE_SLIDER_MIN}
      max={SIZE_SLIDER_MAX}
      step={SIZE_SLIDER_STEP}
      value={[value]}
      onValueChange={([next]) => onChange(next)}
      disabled={disabled}
    >
      <Slider.Track className="relative grow rounded-full h-2 bg-gray-200 dark:bg-gray-700">
        <Slider.Range className="absolute h-full rounded-full bg-purple-400 dark:bg-purple-500" />
      </Slider.Track>
      <Slider.Thumb
        id={id}
        aria-label={ariaLabel}
        className="block w-4 h-4 rounded-full bg-white border-2 border-purple-500 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 cursor-pointer"
      />
    </Slider.Root>
    <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums w-4 text-right shrink-0">
      {value}
    </span>
  </div>
);
