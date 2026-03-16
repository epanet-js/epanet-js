import { atom } from "jotai";
import { projectSettingsAtom } from "src/state/project-settings";

export const isUnprojectedAtom = atom((get) => {
  return get(projectSettingsAtom).projectionMapper.projection === "xy-grid";
});

export const gridPreviewAtom = atom(false);
export const gridHiddenAtom = atom(false);

export const showGridAtom = atom((get) => {
  if (get(gridHiddenAtom)) return false;
  return get(isUnprojectedAtom) || get(gridPreviewAtom);
});
