import { atom } from "jotai";
import {
  ModelFactories,
  initializeModelFactories,
  LabelManager,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";

export type { ModelFactories };

export const modelFactoriesAtom = atom<ModelFactories>(
  initializeModelFactories({
    idGenerator: new ConsecutiveIdsGenerator(),
    labelManager: new LabelManager(),
  }),
);
