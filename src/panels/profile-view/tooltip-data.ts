import { ProfileLink, ProfilePoint, TerrainPoint } from "./chart-data";
import type { SldSnap } from "./snap";

export type TooltipContent =
  | {
      kind: "node";
      label: string;
      elevation: number;
      hgl: number | null;
      pressure: number | null;
    }
  | {
      kind: "estimated";
      linkLabel: string | null;
      elevation: number | null;
      hgl: number | null;
      pressure: number | null;
    }
  | { kind: "hidden" };

export type VisibleTooltipContent = Exclude<TooltipContent, { kind: "hidden" }>;

export function getTooltipContent(
  cursorX: number,
  snap: SldSnap,
  points: ProfilePoint[],
  links: ProfileLink[],
  terrain: TerrainPoint[] | null,
  pressureFactor: number | null,
): TooltipContent {
  if (snap?.kind === "node") {
    const nearest = points[snap.index];
    return {
      kind: "node",
      label: nearest.label,
      elevation: nearest.elevation,
      hgl: nearest.head,
      pressure: nearest.pressure,
    };
  }

  const link = snap?.kind === "link" ? snap.link : findLinkAt(cursorX, links);
  const isPumpOrValve = link?.type === "pump" || link?.type === "valve";
  const sampleX = snap?.kind === "link" ? snap.link.midLength : cursorX;

  const elevation = interpolateTerrain(sampleX, terrain);
  const hgl = isPumpOrValve ? null : interpolateHgl(sampleX, points);
  const pressure =
    hgl !== null && elevation !== null && pressureFactor !== null
      ? pressureFactor * (hgl - elevation)
      : null;

  if (
    link === null &&
    elevation === null &&
    hgl === null &&
    pressure === null
  ) {
    return { kind: "hidden" };
  }

  return {
    kind: "estimated",
    linkLabel: link?.label ?? null,
    elevation,
    hgl,
    pressure,
  };
}

export function findLinkAt(
  x: number,
  links: ProfileLink[] | null,
): ProfileLink | null {
  if (!links) return null;
  for (const link of links) {
    if (x >= link.startLength && x <= link.endLength) return link;
  }
  return null;
}

export function interpolateTerrain(
  x: number,
  terrain: TerrainPoint[] | null,
): number | null {
  if (!terrain || terrain.length === 0) return null;
  if (x <= terrain[0].cumulativeLength) return terrain[0].elevation;
  const last = terrain[terrain.length - 1];
  if (x >= last.cumulativeLength) return last.elevation;
  for (let i = 0; i < terrain.length - 1; i++) {
    const a = terrain[i];
    const b = terrain[i + 1];
    if (x >= a.cumulativeLength && x <= b.cumulativeLength) {
      const span = b.cumulativeLength - a.cumulativeLength;
      if (span <= 0) return a.elevation;
      const t = (x - a.cumulativeLength) / span;
      return a.elevation + (b.elevation - a.elevation) * t;
    }
  }
  return null;
}

export function interpolateHgl(
  x: number,
  points: ProfilePoint[],
): number | null {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (x >= a.cumulativeLength && x <= b.cumulativeLength) {
      if (a.head === null || b.head === null) return null;
      const span = b.cumulativeLength - a.cumulativeLength;
      if (span <= 0) return a.head;
      const t = (x - a.cumulativeLength) / span;
      return a.head + (b.head - a.head) * t;
    }
  }
  return null;
}

export function interpolateElevation(
  x: number,
  points: ProfilePoint[],
): number | null {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (x >= a.cumulativeLength && x <= b.cumulativeLength) {
      const span = b.cumulativeLength - a.cumulativeLength;
      if (span <= 0) return a.elevation;
      const t = (x - a.cumulativeLength) / span;
      return a.elevation + (b.elevation - a.elevation) * t;
    }
  }
  return null;
}
