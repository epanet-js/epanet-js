import {
  LabelManager,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { withPool } from "@epanet-js/id-generator";
import { buildIdPools } from "src/lib/id-pools";
import { WritableIdGenerator } from "./hydraulic-model-builder";

export const buildTestFactories = () => {
  const idGenerator = new WritableIdGenerator();
  const labelManager = new LabelManager();
  const factories = initializeModelFactories({
    idPools: withPool(buildIdPools(), "asset", idGenerator),
    labelManager,
  });
  return { ...factories, idGenerator };
};
