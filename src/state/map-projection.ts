import { atom } from "jotai";
import { dataAtom } from "src/state/data";

export const isUnprojectedAtom = atom((get) => {
  return get(dataAtom).modelMetadata.projectionMapper.projection === "xy-grid";
});

export const gridPreviewAtom = atom(false);
export const gridHiddenAtom = atom(false);

export const showGridAtom = atom((get) => {
  if (get(gridHiddenAtom)) return false;
  return get(isUnprojectedAtom) || get(gridPreviewAtom);
});
