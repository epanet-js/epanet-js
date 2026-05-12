import type { ProfileLink, ProfilePoint } from "../chart-data";

export const SECONDARY_MIN_SPACING_PX = 18;
export const OTHER_VALVE_MIN_SPACING_PX = 48;
export const DEFAULT_ASSUMED_STRIP_WIDTH = 800;

export type SldVisibility = {
  showJunctions: boolean;
  showOtherValves: boolean;
};

export type ComputeSldVisibilityParams = {
  points: ProfilePoint[];
  links: ProfileLink[];
  zoomStart: number;
  zoomEnd: number;
  totalLength: number;
  stripPixelWidth: number | null;
};

export function computeSldVisibility({
  points,
  links,
  zoomStart,
  zoomEnd,
  totalLength,
  stripPixelWidth,
}: ComputeSldVisibilityParams): SldVisibility {
  const xMin = (zoomStart / 100) * totalLength;
  const xMax = (zoomEnd / 100) * totalLength;
  const effectiveWidth = stripPixelWidth ?? DEFAULT_ASSUMED_STRIP_WIDTH;

  let visibleJunctions = 0;
  for (const p of points) {
    if (
      p.nodeType === "junction" &&
      p.cumulativeLength >= xMin &&
      p.cumulativeLength <= xMax
    ) {
      visibleJunctions++;
    }
  }

  let visibleOtherValves = 0;
  for (const l of links) {
    if (
      l.type === "valve" &&
      l.valveKind !== "prv" &&
      l.midLength >= xMin &&
      l.midLength <= xMax
    ) {
      visibleOtherValves++;
    }
  }

  const showJunctions =
    visibleJunctions === 0 ||
    effectiveWidth / visibleJunctions >= SECONDARY_MIN_SPACING_PX;
  const showOtherValves =
    visibleOtherValves === 0 ||
    effectiveWidth / visibleOtherValves >= OTHER_VALVE_MIN_SPACING_PX;

  return { showJunctions, showOtherValves };
}
