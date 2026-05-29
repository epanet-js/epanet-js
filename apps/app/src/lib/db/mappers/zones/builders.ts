import type { Zones } from "src/lib/zones";
import { zoneRowSchema, parseRows } from "@epanet-js/ejsdb";

export const buildZonesData = (rawRows: unknown[]): Zones => {
  const rows = parseRows(zoneRowSchema, rawRows, "Zone");
  const zones: Zones = {};
  for (const row of rows) {
    zones[row.id] = {
      id: row.id,
      label: row.label,
      geometry: JSON.parse(row.geometry),
      bbox: JSON.parse(row.bbox),
      adjacentZones: JSON.parse(row.adjacent_zones),
    };
  }
  return zones;
};
