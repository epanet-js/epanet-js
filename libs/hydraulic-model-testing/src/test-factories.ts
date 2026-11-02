import {
  LabelManager,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { IdPoolsGenerator, withPool } from "@epanet-js/id-generator";
import { WritableIdGenerator } from "./hydraulic-model-builder";

export const buildTestFactories = () => {
  const idGenerator = new WritableIdGenerator();
  const labelManager = new LabelManager();
  const factories = initializeModelFactories({
    idPools: withPool(
      new IdPoolsGenerator({
        asset: 0,
        customerPoint: 0,
        pattern: 0,
        curve: 0,
        zone: 0,
      }),
      "asset",
      idGenerator,
    ),
    labelManager,
  });
  return { ...factories, idGenerator };
};
