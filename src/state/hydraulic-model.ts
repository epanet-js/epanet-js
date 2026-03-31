import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";

export const nullHydraulicModel: HydraulicModel = initializeHydraulicModel({});

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
