"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import throttle from "lodash/throttle";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { ProfileLink, ProfilePoint, TerrainPoint } from "./chart-data";
import { coordinatesAtLength, PathSegment } from "./path-position";
import { getTooltipContent, TooltipContent } from "./tooltip-data";

const SNAP_PIXEL_THRESHOLD = 5;
const HGL_COLOR = "#2563eb";

interface ProfileTooltipProps {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<any>;
  points: ProfilePoint[];
  links: ProfileLink[];
  terrain: TerrainPoint[] | null;
  pressureFactor: number | null;
  pathSegments: PathSegment[];
  elevColor: string;
  translate: (key: string) => string;
  setHoverHighlight: (coordinates: [number, number] | null) => void;
}

type VisibleTooltipContent = Exclude<TooltipContent, { kind: "hidden" }>;
type TooltipState = { px: number; py: number; content: VisibleTooltipContent };

export function ProfileTooltip({
  containerRef,
  chartRef,
  points,
  links,
  terrain,
  pressureFactor,
  pathSegments,
  elevColor,
  translate,
  setHoverHighlight,
}: ProfileTooltipProps) {
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);

  const depsRef = useRef({
    points,
    links,
    terrain,
    pressureFactor,
    pathSegments,
    setHoverHighlight,
  });
  depsRef.current = {
    points,
    links,
    terrain,
    pressureFactor,
    pathSegments,
    setHoverHighlight,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scheduleHover = throttle(
      (coords: [number, number] | null) => {
        depsRef.current.setHoverHighlight(coords);
      },
      100,
      { leading: false, trailing: true },
    );

    const handleMove = (e: MouseEvent) => {
      const chart = chartRef.current;
      if (!chart) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      /* eslint-disable @typescript-eslint/no-unsafe-call,
         @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-assignment */
      const result =
        chart.convertFromPixel({ gridIndex: 0 }, [px, py]) ??
        chart.convertFromPixel({ seriesIndex: 0 }, [px, py]);
      const cursorX = Array.isArray(result) ? (result[0] as number) : NaN;
      if (Number.isNaN(cursorX)) {
        chart.dispatchAction({
          type: "updateAxisPointer",
          currTrigger: "leave",
        });
        setTooltipState(null);
        scheduleHover(null);
        return;
      }

      const deps = depsRef.current;
      let snappedIdx: number | null = null;
      let snappedPixelX: number | null = null;
      let bestDist = SNAP_PIXEL_THRESHOLD;
      for (let i = 0; i < deps.points.length; i++) {
        const pointPx = chart.convertToPixel(
          { xAxisIndex: 0 },
          deps.points[i].cumulativeLength,
        );
        if (typeof pointPx !== "number" || Number.isNaN(pointPx)) continue;
        const d = Math.abs(pointPx - px);
        if (d <= bestDist) {
          bestDist = d;
          snappedIdx = i;
          snappedPixelX = pointPx;
        }
      }

      const effectivePixelX = snappedPixelX ?? px;
      chart.dispatchAction({
        type: "updateAxisPointer",
        currTrigger: "mousemove",
        x: effectivePixelX,
        y: py,
      });
      /* eslint-enable */

      const markerCoordinates =
        snappedIdx !== null
          ? deps.points[snappedIdx].coordinates
          : coordinatesAtLength(deps.pathSegments, cursorX);
      scheduleHover(markerCoordinates);

      const content = getTooltipContent(
        cursorX,
        snappedIdx,
        deps.points,
        deps.links,
        deps.terrain,
        deps.pressureFactor,
      );
      if (content.kind === "hidden") {
        setTooltipState(null);
        return;
      }
      setTooltipState({ px, py, content });
    };

    const handleLeave = () => {
      const chart = chartRef.current;
      if (chart) {
        /* eslint-disable @typescript-eslint/no-unsafe-call,
           @typescript-eslint/no-unsafe-member-access */
        chart.dispatchAction({
          type: "updateAxisPointer",
          currTrigger: "leave",
        });
        /* eslint-enable */
      }
      setTooltipState(null);
      scheduleHover(null);
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
      scheduleHover.cancel();
      depsRef.current.setHoverHighlight(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tooltipState) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: tooltipState.px + 12,
        top: tooltipState.py + 12,
        pointerEvents: "none",
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 4,
        padding: "6px 8px",
        fontSize: 12,
        lineHeight: 1.5,
        color: "#111827",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        zIndex: 1000,
        whiteSpace: "nowrap",
      }}
    >
      <TooltipBody
        content={tooltipState.content}
        elevColor={elevColor}
        translate={translate}
      />
    </div>
  );
}

function TooltipBody({
  content,
  elevColor,
  translate,
}: {
  content: VisibleTooltipContent;
  elevColor: string;
  translate: (key: string) => string;
}) {
  if (content.kind === "node") {
    return (
      <>
        <strong>{content.label}</strong>
        <Row
          color={elevColor}
          label={translate("profileView.elevation")}
          value={content.elevation}
        />
        {content.hgl !== null && (
          <Row
            color={HGL_COLOR}
            label={translate("profileView.hgl")}
            value={content.hgl}
          />
        )}
        {content.pressure !== null && (
          <Row label={translate("pressure")} value={content.pressure} />
        )}
      </>
    );
  }

  return (
    <>
      <strong>{content.linkLabel ?? translate("profileView.estimated")}</strong>
      {content.linkLabel !== null && (
        <em style={{ opacity: 0.7, fontStyle: "italic", marginLeft: 4 }}>
          ({translate("profileView.estimated")})
        </em>
      )}
      {content.elevation !== null && (
        <Row
          color={elevColor}
          label={translate("profileView.elevation")}
          value={content.elevation}
        />
      )}
      {content.hgl !== null && (
        <Row
          color={HGL_COLOR}
          label={translate("profileView.hgl")}
          value={content.hgl}
        />
      )}
      {content.pressure !== null && (
        <Row label={translate("pressure")} value={content.pressure} />
      )}
    </>
  );
}

function Row({
  color,
  label,
  value,
}: {
  color?: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <Dot color={color} />
      {label}: {localizeDecimal(value, { decimals: 2 })}
    </div>
  );
}

function Dot({ color }: { color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        background: color ?? "transparent",
        marginRight: 4,
        borderRadius: "50%",
      }}
    />
  );
}
