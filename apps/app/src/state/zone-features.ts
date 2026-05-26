import { atom } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { buildZoneFeatures } from "src/map/data-source/zones";

export const zoneFeaturesAtom = atom((get) => {
  const model = get(stagingModelDerivedAtom);
  return buildZoneFeatures(model.zones);
});
