import { IdGenerator } from "@epanet-js/id-generator";
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
};

type ModelFactoriesOptions = {
  idGenerator: IdGenerator;
  labelManager: LabelManager;
  labelCounters?: Map<LabelType, number>;
};

const buildModelFactories = (
  options: ModelFactoriesOptions,
  assetFactory: AssetFactory,
): ModelFactories => {
  const labelCounters = options.labelCounters ?? new Map<LabelType, number>();
  options.labelManager.adoptCounters(labelCounters);

  return {
    customerPointFactory: new CustomerPointFactory(
      options.idGenerator,
      options.labelManager,
    ),
    assetFactory,
    labelManager: options.labelManager,
    labelCounters,
    idGenerator: options.idGenerator,
  };
};

export const initializeModelFactories = (
  options: ModelFactoriesOptions,
): ModelFactories =>
  buildModelFactories(
    options,
    new AssetFactory(options.idGenerator, options.labelManager),
  );
