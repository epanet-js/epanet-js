import { atom } from "jotai";
import { zonesAtom } from "./zones";
import { symbologyAtom } from "src/state/map-symbology";
import {
  assignZoneColors,
  getQualitativePaletteColors,
} from "src/map/layers/zones";
import type { ZoneId } from "src/lib/zones";

export const zoneColorAssignmentsAtom = atom<Record<ZoneId, string>>((get) => {
  const zones = get(zonesAtom);
  const symbology = get(symbologyAtom);
  const palette = getQualitativePaletteColors(symbology.zone.paletteName);
  return assignZoneColors(zones, palette);
});
