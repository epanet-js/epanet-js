import type * as mapboxgl from "mapbox-gl";

export const buildZoneColorExpression = (
  colorAssignments: Record<number, string>,
  defaultColor: string,
): mapboxgl.Expression => {
  const entries = Object.entries(colorAssignments);
  if (entries.length === 0)
    return defaultColor as unknown as mapboxgl.Expression;

  const matchEntries: (number | string)[] = [];
  for (const [id, color] of entries) {
    matchEntries.push(Number(id));
    matchEntries.push(color);
  }

  return ["match", ["get", "id"], ...matchEntries, defaultColor];
};
