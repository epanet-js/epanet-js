import { atom } from "jotai";
import { buildZoneFeatures } from "src/map/data-source/zones";
import { projectSettingsAtom } from "./project-settings";

export const zoneFeaturesAtom = atom((get) => {
  const projectSettings = get(projectSettingsAtom);
  return buildZoneFeatures(projectSettings.zones);
});
