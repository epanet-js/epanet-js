import { atom } from "jotai";
import {
  ModelFactories,
  initializeModelFactories,
  LabelManager,
} from "@epanet-js/hydraulic-model";
import { buildIdPools } from "src/lib/id-pools";

export type { ModelFactories };

export const modelFactoriesAtom = atom<ModelFactories>(
  initializeModelFactories({
    idPools: buildIdPools(),
    labelManager: new LabelManager(),
  }),
);
