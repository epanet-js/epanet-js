import { IdGenerator } from "src/lib/id-generator";
import { CustomerPointFactory } from "./customer-point-factory";
import {
  LabelManager,
  type LabelType,
} from "src/hydraulic-model/label-manager";
import { AssetFactory } from "./asset-factory";
import { DefaultsSpec } from "src/lib/project-settings/quantities-spec";

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

export const initializeModelFactories = (options: {
  idGenerator: IdGenerator;
  labelManager: LabelManager;
  defaults: DefaultsSpec;
  labelCounters?: Map<LabelType, number>;
}): ModelFactories => {
  const labelCounters = options.labelCounters ?? new Map();
  options.labelManager.adoptCounters(labelCounters);

  return {
    customerPointFactory: new CustomerPointFactory(
      options.idGenerator,
      options.labelManager,
    ),
    assetFactory: new AssetFactory(
      options.defaults,
      options.idGenerator,
      options.labelManager,
    ),
    labelManager: options.labelManager,
    labelCounters,
    idGenerator: options.idGenerator,
  };
};
