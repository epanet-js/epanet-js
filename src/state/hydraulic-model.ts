import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import { Quantities, presets } from "src/model-metadata/quantities-spec";

const quantities = new Quantities(presets.LPS);

export const nullHydraulicModel: HydraulicModel = initializeHydraulicModel({
  units: quantities.units,
  defaults: quantities.defaults,
});

export const stagingModelAtom = atom<HydraulicModel>(nullHydraulicModel);

export const baseModelAtom = atom<HydraulicModel>(nullHydraulicModel);

export const assetsAtom = focusAtom(stagingModelAtom, (optic) =>
  optic.prop("assets"),
);

export const customerPointsAtom = focusAtom(stagingModelAtom, (optic) =>
  optic.prop("customerPoints"),
);
