import {
  LabelManager,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { WritableIdGenerator } from "./hydraulic-model-builder";

export const buildTestFactories = () => {
  const idGenerator = new WritableIdGenerator();
  const labelManager = new LabelManager();
  const factories = initializeModelFactories({
    idGenerator,
    labelManager,
  });
  return { ...factories, idGenerator };
};
