import { atom } from "jotai";
import {
  ModelFactories,
  initializeModelFactories,
} from "src/hydraulic-model/factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { presets } from "src/lib/project-settings/quantities-spec";

export type { ModelFactories };

export const modelFactoriesAtom = atom<ModelFactories>(
  initializeModelFactories({
    labelManager: new LabelManager(),
    defaults: presets.LPS.defaults,
  }),
);
