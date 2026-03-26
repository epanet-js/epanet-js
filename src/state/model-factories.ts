import { atom } from "jotai";
import {
  ModelFactories,
  initializeModelFactories,
} from "src/hydraulic-model/factories";
import { LabelManager } from "src/hydraulic-model/label-manager";

export type { ModelFactories };

export const modelFactoriesAtom = atom<ModelFactories>(
  initializeModelFactories({ labelManager: new LabelManager() }),
);
