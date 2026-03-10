import { atom } from "jotai";
import {
  ModelFactories,
  initializeModelFactories,
} from "src/hydraulic-model/factories";

export type { ModelFactories };

export const modelFactoriesAtom = atom<ModelFactories>(
  initializeModelFactories(),
);
