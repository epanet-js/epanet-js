import { atom } from "jotai";
import { zonesAtom } from "./zones";
import { assignZoneColors } from "src/map/layers/zones";
import type { ZoneId } from "src/lib/zones";

export const zoneColorAssignmentsAtom = atom<Record<ZoneId, string>>((get) => {
  const zones = get(zonesAtom);
  return assignZoneColors(zones);
});
