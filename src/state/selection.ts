import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import { USelection } from "src/selection/selection";
import { dataAtom } from "src/state/data";
import { stagingModelAtom } from "src/state/hydraulic-model";

export const selectedFeaturesAtom = atom((get) => {
  const data = get(dataAtom);
  const hydraulicModel = get(stagingModelAtom);
  return USelection.getSelectedFeatures({ ...data, hydraulicModel });
});

export const selectionAtom = focusAtom(dataAtom, (optic) =>
  optic.prop("selection"),
);
