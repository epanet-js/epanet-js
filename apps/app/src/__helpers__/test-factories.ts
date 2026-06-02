import {
  LabelManager,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { presets } from "src/lib/project-settings/quantities-spec";
import { WritableIdGenerator } from "./hydraulic-model-builder";

export const buildTestFactories = () => {
  const idGenerator = new WritableIdGenerator();
  const labelManager = new LabelManager();
  const factories = initializeModelFactories({
    idGenerator,
    labelManager,
    defaults: presets.LPS.defaults,
  });
  return { ...factories, idGenerator };
};
