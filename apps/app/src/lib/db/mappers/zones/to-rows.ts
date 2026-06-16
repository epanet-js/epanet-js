import type { Zones } from "src/lib/zones";
import { parseRows, zoneRowSchema, type ZoneRow } from "@epanet-js/ejsdb";

export const zonesToRows = (zones: Zones): ZoneRow[] =>
  Array.from(zones.values(), (zone) => ({
    id: zone.id,
    label: zone.label,
    geometry: JSON.stringify(zone.geometry),
    bbox: JSON.stringify(zone.bbox),
  }));

export const serializeZones = (zones: Zones): ZoneRow[] =>
  parseRows(zoneRowSchema, zonesToRows(zones), "Zone");
