import type { Zones } from "src/lib/zones";
import type { ZoneRow } from "src/lib/ejsdb";

export const zonesToRows = (zones: Zones): ZoneRow[] =>
  Object.values(zones).map((zone) => ({
    id: zone.id,
    label: zone.label,
    geometry: JSON.stringify(zone.geometry),
  }));
