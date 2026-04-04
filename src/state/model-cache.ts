import { atom } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import type { LabelManager } from "src/hydraulic-model/label-manager";

type ModelCacheEntry = {
  model: HydraulicModel;
  labelManager: LabelManager;
};

export const modelCacheAtom = atom(new Map<string, ModelCacheEntry>());
