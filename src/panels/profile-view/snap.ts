import type { ProfileLink, ProfilePoint } from "./chart-data";
import { interpolateElevation, interpolateHgl } from "./tooltip-data";

export const SNAP_PIXEL_THRESHOLD = 10;

export type SldSnap =
  | { kind: "node"; index: number; pixelX: number }
  | { kind: "link"; link: ProfileLink; pixelX: number }
  | null;

interface ChartLike {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  convertToPixel: (...args: any[]) => any;
  /* eslint-enable */
}

export function isNearMainPlotLine(
  chart: ChartLike,
  cursorX: number,
  py: number,
  points: ProfilePoint[],
  threshold: number = SNAP_PIXEL_THRESHOLD,
): boolean {
  /* eslint-disable @typescript-eslint/no-unsafe-call,
     @typescript-eslint/no-unsafe-member-access,
     @typescript-eslint/no-unsafe-assignment */
  const elevation = interpolateElevation(cursorX, points);
  if (elevation !== null) {
    const elevPy = chart.convertToPixel({ yAxisIndex: 0 }, elevation);
    if (typeof elevPy === "number" && Math.abs(py - elevPy) <= threshold) {
      return true;
    }
  }
  const hgl = interpolateHgl(cursorX, points);
  if (hgl !== null) {
    const hglPy = chart.convertToPixel({ yAxisIndex: 0 }, hgl);
    if (typeof hglPy === "number" && Math.abs(py - hglPy) <= threshold) {
      return true;
    }
  }
  return false;
  /* eslint-enable */
}

export function pickSldSnap(
  chart: ChartLike,
  points: ProfilePoint[],
  links: ProfileLink[],
  px: number,
): SldSnap {
  const iconLink = nearestIconLink(chart, links, px);
  if (iconLink) return iconLink;

  return nearestNode(chart, points, px);
}

function nearestIconLink(
  chart: ChartLike,
  links: ProfileLink[],
  px: number,
): SldSnap {
  let best: ProfileLink | null = null;
  let bestPx = NaN;
  let bestDist = SNAP_PIXEL_THRESHOLD;
  for (const link of links) {
    if (link.type !== "pump" && link.type !== "valve") continue;
    /* eslint-disable @typescript-eslint/no-unsafe-call,
       @typescript-eslint/no-unsafe-member-access,
       @typescript-eslint/no-unsafe-assignment */
    const linkPx = chart.convertToPixel({ xAxisIndex: 0 }, link.midLength);
    /* eslint-enable */
    if (typeof linkPx !== "number" || Number.isNaN(linkPx)) continue;
    const d = Math.abs(linkPx - px);
    if (d <= bestDist) {
      bestDist = d;
      best = link;
      bestPx = linkPx;
    }
  }
  return best ? { kind: "link", link: best, pixelX: bestPx } : null;
}

function nearestNode(
  chart: ChartLike,
  points: ProfilePoint[],
  px: number,
): SldSnap {
  let bestIdx: number | null = null;
  let bestPx = NaN;
  let bestDist = SNAP_PIXEL_THRESHOLD;
  for (let i = 0; i < points.length; i++) {
    /* eslint-disable @typescript-eslint/no-unsafe-call,
       @typescript-eslint/no-unsafe-member-access,
       @typescript-eslint/no-unsafe-assignment */
    const pointPx = chart.convertToPixel(
      { xAxisIndex: 0 },
      points[i].cumulativeLength,
    );
    /* eslint-enable */
    if (typeof pointPx !== "number" || Number.isNaN(pointPx)) continue;
    const d = Math.abs(pointPx - px);
    if (d <= bestDist) {
      bestDist = d;
      bestIdx = i;
      bestPx = pointPx;
    }
  }
  return bestIdx !== null
    ? { kind: "node", index: bestIdx, pixelX: bestPx }
    : null;
}
