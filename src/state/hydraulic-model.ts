import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import { Quantities, presets } from "src/model-metadata/quantities-spec";

const quantities = new Quantities(presets.LPS);

export const nullHydraulicModel: HydraulicModel = initializeHydraulicModel({
  defaults: quantities.defaults,
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
