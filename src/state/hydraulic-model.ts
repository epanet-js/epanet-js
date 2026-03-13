import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import { presets } from "src/model-metadata/quantities-spec";

export const nullHydraulicModel: HydraulicModel = initializeHydraulicModel({
  defaults: presets.LPS.defaults,
});

export const stagingModelAtom = atom<HydraulicModel>(nullHydraulicModel);

export const baseModelAtom = atom<HydraulicModel>(nullHydraulicModel);

export const assetsAtom = focusAtom(stagingModelAtom, (optic) =>
  optic.prop("assets"),
);

export const patternsAtom = focusAtom(stagingModelAtom, (optic) =>
  optic.prop("patterns"),
);

export const customerPointsAtom = focusAtom(stagingModelAtom, (optic) =>
  optic.prop("customerPoints"),
);
