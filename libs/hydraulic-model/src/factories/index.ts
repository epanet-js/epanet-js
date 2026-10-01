import { IdGenerator, PooledIdGenerator } from "@epanet-js/id-generator";
import { CustomerPointFactory } from "./customer-point-factory";
import { LabelManager, type LabelType } from "../label-manager";
import { AssetFactory } from "./asset-factory";
import { ZoneFactory } from "./zone-factory";

export {
  CustomerPointFactory,
  buildCustomerPointPreviewFactory,
} from "./customer-point-factory";
export { AssetFactory } from "./asset-factory";
export { ZoneFactory } from "./zone-factory";

export type ModelFactories = {
  customerPointFactory: CustomerPointFactory;
  assetFactory: AssetFactory;
  zoneFactory: ZoneFactory;
  labelManager: LabelManager;
  labelCounters: Map<LabelType, number>;
  idGenerator: IdGenerator;
  idPools: PooledIdGenerator;
};

type ModelFactoriesOptions = {
  idPools: PooledIdGenerator;
  labelManager: LabelManager;
  labelCounters?: Map<LabelType, number>;
};

export const initializeModelFactories = (
  options: ModelFactoriesOptions,
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
    zoneFactory: new ZoneFactory(options.idPools.forPool("zone")),
    labelManager: options.labelManager,
    labelCounters,
    idGenerator,
    idPools: options.idPools,
  };
};
