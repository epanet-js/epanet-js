import {
  IdGenerator,
  PooledIdGenerator,
  sharedIdPools,
} from "@epanet-js/id-generator";
import { CustomerPointFactory } from "./customer-point-factory";
import { LabelManager, type LabelType } from "../label-manager";
import { AssetFactory } from "./asset-factory";

export {
  CustomerPointFactory,
  buildCustomerPointPreviewFactory,
} from "./customer-point-factory";
export { AssetFactory } from "./asset-factory";

export type ModelFactories = {
  customerPointFactory: CustomerPointFactory;
  assetFactory: AssetFactory;
  labelManager: LabelManager;
  labelCounters: Map<LabelType, number>;
  idGenerator: IdGenerator;
  idPools: PooledIdGenerator;
};

type ModelFactoriesOptions = {
  idGenerator: IdGenerator;
  labelManager: LabelManager;
  labelCounters?: Map<LabelType, number>;
};

type PooledModelFactoriesOptions = {
  idPools: PooledIdGenerator;
  labelManager: LabelManager;
  labelCounters?: Map<LabelType, number>;
};

const buildModelFactories = (
  options: PooledModelFactoriesOptions,
): ModelFactories => {
  const labelCounters = options.labelCounters ?? new Map<LabelType, number>();
  options.labelManager.adoptCounters(labelCounters);
  const idGenerator = options.idPools.forPool("asset");

  return {
    customerPointFactory: new CustomerPointFactory(
      options.idPools.forPool("customerPoint"),
      options.labelManager,
    ),
    assetFactory: new AssetFactory(idGenerator, options.labelManager),
    labelManager: options.labelManager,
    labelCounters,
    idGenerator,
    idPools: options.idPools,
  };
};

export const initializeModelFactories = (
  options: ModelFactoriesOptions,
): ModelFactories =>
  buildModelFactories({
    idPools: sharedIdPools(options.idGenerator),
    labelManager: options.labelManager,
    labelCounters: options.labelCounters,
  });

export const initializeModelFactoriesWithPools = (
  options: PooledModelFactoriesOptions,
): ModelFactories => buildModelFactories(options);
