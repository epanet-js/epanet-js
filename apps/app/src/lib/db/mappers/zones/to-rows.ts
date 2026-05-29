import type { Zones } from "src/lib/zones";
import type { ZoneRow } from "@epanet-js/ejsdb";

export const zonesToRows = (zones: Zones): ZoneRow[] =>
  Object.values(zones).map((zone) => ({
    id: zone.id,
    label: zone.label,
    geometry: JSON.stringify(zone.geometry),
    bbox: JSON.stringify(zone.bbox),
    adjacent_zones: JSON.stringify(zone.adjacentZones),
  }));
