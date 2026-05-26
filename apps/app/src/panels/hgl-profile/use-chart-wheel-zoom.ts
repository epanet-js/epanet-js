"use client";
import { useEffect, useRef, type RefObject } from "react";

interface UseChartWheelZoomParams {
  containerRef: RefObject<HTMLDivElement | null>;
  chartRef: RefObject<any>;
  zoomRef: RefObject<{ start: number; end: number }>;
  totalLength: number;
}

const ZOOM_STEP = 1.1;

export function useChartWheelZoom({
  containerRef,
  chartRef,
  zoomRef,
  totalLength,
}: UseChartWheelZoomParams): void {
  const totalLengthRef = useRef(totalLength);
  totalLengthRef.current = totalLength;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      /* eslint-disable @typescript-eslint/no-unsafe-call,
         @typescript-eslint/no-unsafe-member-access,
         @typescript-eslint/no-unsafe-assignment */
      const chart = chartRef.current;
      const total = totalLengthRef.current;
      if (!chart || total <= 0) return;
      if (e.deltaY === 0) return;

      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (
        chart.containPixel({ gridIndex: 0 }, [px, py]) ||
        chart.containPixel({ gridIndex: 1 }, [px, py])
      ) {
        return;
      }

      const model = chart.getModel?.();
      const mainRect = model
        ?.getComponent?.("grid", 0)
        ?.coordinateSystem?.getRect?.();
      const stripRect = model
        ?.getComponent?.("grid", 1)
        ?.coordinateSystem?.getRect?.();
      if (!mainRect || !stripRect) return;

      const gridLeft = mainRect.x;
      const gridRight = mainRect.x + mainRect.width;
      const verticalTop = stripRect.y;
      const verticalBottom = mainRect.y + mainRect.height;
      if (px < gridLeft || px > gridRight) return;
      if (py < verticalTop || py > verticalBottom) return;

      const current = zoomRef.current ?? { start: 0, end: 100 };
      const cursorRatio = (px - gridLeft) / (gridRight - gridLeft);
      const cursorPct =
        current.start + cursorRatio * (current.end - current.start);
      const scale = e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;

      let newStart = cursorPct - (cursorPct - current.start) * scale;
      let newEnd = cursorPct + (current.end - cursorPct) * scale;
      newStart = Math.max(0, Math.min(100, newStart));
      newEnd = Math.max(0, Math.min(100, newEnd));
      if (newEnd <= newStart) return;

      const spanData = ((newEnd - newStart) / 100) * total;
      if (spanData < 1) return;

      e.preventDefault();
      chart.dispatchAction({
        type: "dataZoom",
        start: newStart,
        end: newEnd,
      });
      /* eslint-enable */
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
