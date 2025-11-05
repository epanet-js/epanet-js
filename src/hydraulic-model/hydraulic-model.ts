import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder, DefaultQuantities } from "./asset-builder";
import { UnitsSpec } from "src/model-metadata/quantities-spec";
import { nanoid } from "nanoid";
import { HeadlossFormula } from "./asset-types/pipe";
import { ConsecutiveIdsGenerator } from "./id-generator";
import { LabelManager } from "./label-manager";
import { Demands, nullDemands } from "./demands";
import { CustomerPoints, initializeCustomerPoints } from "./customer-points";
import { CustomerPointsLookup } from "./customer-points-lookup";
import { AssetIndex } from "./asset-index";

export type HydraulicModel = {
  version: string;
  assets: AssetsMap;
  customerPoints: CustomerPoints;
  customerPointsLookup: CustomerPointsLookup;
  assetBuilder: AssetBuilder;
  topology: Topology;
  assetIndex: AssetIndex;
  units: UnitsSpec;
  demands: Demands;
  headlossFormula: HeadlossFormula;
  labelManager: LabelManager;
};

export { AssetsMap };

export const initializeHydraulicModel = ({
  units,
  defaults,
  headlossFormula = "H-W",
  demands = nullDemands,
}: {
  units: UnitsSpec;
  defaults: DefaultQuantities;
  headlossFormula?: HeadlossFormula;
  demands?: Demands;
}) => {
  const labelManager = new LabelManager();
  const idGenerator = new ConsecutiveIdsGenerator();
  const assets = new Map();
  return {
    version: nanoid(),
    assets,
    customerPoints: initializeCustomerPoints(),
    customerPointsLookup: new CustomerPointsLookup(),
    assetBuilder: new AssetBuilder(units, defaults, idGenerator, labelManager),
    topology: new Topology(),
    assetIndex: new AssetIndex(idGenerator, assets),
    demands,
    units,
    labelManager,
    headlossFormula,
  };
};
