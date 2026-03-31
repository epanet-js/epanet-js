import { ConsecutiveIdsGenerator, IdGenerator } from "src/lib/id-generator";
import { CustomerPointFactory } from "./customer-point-factory";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { AssetFactory } from "./asset-factory";
import { DefaultsSpec } from "src/lib/project-settings/quantities-spec";

export { CustomerPointFactory } from "./customer-point-factory";
export { AssetFactory } from "./asset-factory";

export type ModelFactories = {
  customerPointFactory: CustomerPointFactory;
  assetFactory: AssetFactory;
};

export const initializeModelFactories = (options: {
  idGenerator?: IdGenerator;
  labelManager: LabelManager;
  defaults: DefaultsSpec;
}): ModelFactories => {
  const idGenerator = options.idGenerator ?? new ConsecutiveIdsGenerator();
  return {
    customerPointFactory: new CustomerPointFactory(
      idGenerator,
      options.labelManager,
    ),
    assetFactory: new AssetFactory(
      options.defaults,
      idGenerator,
      options.labelManager,
    ),
  };
};
