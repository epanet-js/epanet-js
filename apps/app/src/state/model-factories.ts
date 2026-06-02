import { atom } from "jotai";
import {
  ModelFactories,
  initializeModelFactories,
  LabelManager,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { presets } from "src/lib/project-settings/quantities-spec";

export type { ModelFactories };

export const modelFactoriesAtom = atom<ModelFactories>(
  initializeModelFactories({
    idGenerator: new ConsecutiveIdsGenerator(),
    labelManager: new LabelManager(),
    defaults: presets.LPS.defaults,
  }),
);
