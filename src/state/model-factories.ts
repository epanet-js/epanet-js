import { atom } from "jotai";
import {
  ModelFactories,
  initializeModelFactories,
} from "src/lib/model-factory";

export type { ModelFactories };

export const modelFactoriesAtom = atom<ModelFactories>(
  initializeModelFactories(),
);
