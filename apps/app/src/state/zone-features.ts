import { atom } from "jotai";
import { buildZoneFeatures } from "src/map/data-source/zones";
import { zonesAtom } from "./zones";

export const zoneFeaturesAtom = atom((get) => {
  const zones = get(zonesAtom);
  return buildZoneFeatures(zones);
});
