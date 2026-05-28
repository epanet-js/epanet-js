import type * as mapboxgl from "mapbox-gl";

/**
 * Qualitative color palette for zone fills.
 * Designed for high visual distinctness so users can quickly
 * differentiate adjacent zones at a glance.
 */
const ZONE_QUALITATIVE_PALETTE = [
  "#7F3C8D",
  "#11A579",
  "#3969AC",
  "#F2B701",
  "#E73F74",
  "#80BA5A",
  "#E68310",
  "#008695",
  "#CF1C90",
  "#f97b72",
  "#4b4b8f",
];

export const buildZoneColorByLabelExpression = (
  zoneIds: number[],
  defaultColor: string,
): mapboxgl.Expression => {
  if (zoneIds.length === 0)
    return defaultColor as unknown as mapboxgl.Expression;

  const matchEntries: (number | string)[] = [];
  for (let i = 0; i < zoneIds.length; i++) {
    matchEntries.push(zoneIds[i]);
    matchEntries.push(
      ZONE_QUALITATIVE_PALETTE[i % ZONE_QUALITATIVE_PALETTE.length],
    );
  }

  return ["match", ["get", "id"], ...matchEntries, defaultColor];
};
