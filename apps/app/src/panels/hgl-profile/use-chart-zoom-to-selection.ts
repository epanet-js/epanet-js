"use client";
import { useEffect, type RefObject } from "react";
import { useAtomValue } from "jotai";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import type { ProfileLink, ProfilePoint } from "./chart-data";

const TARGET_LINK_FRACTION = 0.1;
const MIN_SPAN_PCT = 5;
const MAX_SPAN_PCT = 100;
const NODE_DEFAULT_SPAN_PCT = 20;
const NODE_NEIGHBOR_LINKS = 4;

interface UseChartZoomToSelectionParams {
  chartRef: RefObject<any>;
  zoomRef: RefObject<{ start: number; end: number }>;
  points: ProfilePoint[];
  links: ProfileLink[];
  totalLength: number;
}

export function useChartZoomToSelection({
  chartRef,
  zoomRef,
  points,
  links,
  totalLength,
}: UseChartZoomToSelectionParams): void {
  const selection = useAtomValue(selectionAtom);
  const ids = USelection.toIds(selection);
  const idsKey = ids.join(",");

  useEffect(() => {
    /* eslint-disable @typescript-eslint/no-unsafe-call,
       @typescript-eslint/no-unsafe-member-access */
    const chart = chartRef.current;
    if (!chart || totalLength <= 0 || ids.length === 0) return;

    const range = findAssetRangeOnPath(ids, points, links);
    if (!range) return;

    const currentZoom = zoomRef.current ?? { start: 0, end: 100 };
    const rangeStartPct = (range.start / totalLength) * 100;
    const rangeEndPct = (range.end / totalLength) * 100;
    if (rangeEndPct >= currentZoom.start && rangeStartPct <= currentZoom.end) {
      return;
    }

    const zoom = computeZoomWindow(range, totalLength, links.length);
    chart.dispatchAction({
      type: "dataZoom",
      start: zoom.start,
      end: zoom.end,
    });
    /* eslint-enable */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, points, links, totalLength]);
}

function findAssetRangeOnPath(
  ids: readonly number[],
  points: ProfilePoint[],
  links: ProfileLink[],
): { start: number; end: number } | null {
  const idSet = new Set<number>(ids);
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (idSet.has(p.nodeId)) {
      if (p.cumulativeLength < min) min = p.cumulativeLength;
      if (p.cumulativeLength > max) max = p.cumulativeLength;
    }
  }
  for (const l of links) {
    if (idSet.has(l.linkId)) {
      if (l.startLength < min) min = l.startLength;
      if (l.endLength > max) max = l.endLength;
    }
  }
  return min === Infinity ? null : { start: min, end: max };
}

function computeZoomWindow(
  range: { start: number; end: number },
  totalLength: number,
  linkCount: number,
): { start: number; end: number } {
  const startPct = (range.start / totalLength) * 100;
  const endPct = (range.end / totalLength) * 100;
  const widthPct = endPct - startPct;
  const isPoint = widthPct === 0;

  let requiredSpan = isPoint
    ? Math.max(
        NODE_DEFAULT_SPAN_PCT,
        linkCount > 0
          ? (NODE_NEIGHBOR_LINKS / linkCount) * 100
          : NODE_DEFAULT_SPAN_PCT,
      )
    : widthPct / TARGET_LINK_FRACTION;
  requiredSpan = Math.min(MAX_SPAN_PCT, Math.max(MIN_SPAN_PCT, requiredSpan));

  const center = (startPct + endPct) / 2;
  let start = center - requiredSpan / 2;
  let end = center + requiredSpan / 2;
  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > 100) {
    start -= end - 100;
    end = 100;
  }
  return { start: Math.max(0, start), end: Math.min(100, end) };
}
