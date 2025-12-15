import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { AssetBuilder, DefaultQuantities } from "./asset-builder";
import { UnitsSpec } from "src/model-metadata/quantities-spec";
import { nanoid } from "nanoid";
import { HeadlossFormula } from "./asset-types/pipe";
import { ConsecutiveIdsGenerator } from "./id-generator";
import { LabelManager } from "./label-manager";
import { Demands, createEmptyDemands } from "./demands";
import { EPSTiming } from "./eps-timing";
import { CustomerPoints, initializeCustomerPoints } from "./customer-points";
import { CustomerPointsLookup } from "./customer-points-lookup";
import { AssetIndex } from "./asset-index";
import { Asset } from "./asset-types";
import { Curves } from "./curves";

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
  curves: Curves;
  epsTiming: EPSTiming;
};

export { AssetsMap };

export const initializeHydraulicModel = ({
  units,
  defaults,
  headlossFormula = "H-W",
  demands = createEmptyDemands(),
  epsTiming = {},
}: {
  units: UnitsSpec;
  defaults: DefaultQuantities;
  headlossFormula?: HeadlossFormula;
  demands?: Demands;
  epsTiming?: EPSTiming;
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
    curves: new Map(),
    epsTiming,
  };
};

export const updateHydraulicModelAssets = (
  hydraulicModel: HydraulicModel,
  newAssets?: AssetsMap,
): HydraulicModel => {
  if (newAssets) {
    hydraulicModel.assetIndex.updateAssets(newAssets);
    return {
      ...hydraulicModel,
      assets: newAssets,
    };
  }

  const updatedAssets = new AssetsMap(
    Array.from(hydraulicModel.assets).sort(([, a], [, b]) => sortAssets(a, b)),
  );

  hydraulicModel.assetIndex.updateAssets(updatedAssets);
  return {
    ...hydraulicModel,
    assets: updatedAssets,
  };
};

function sortAssets(a: Asset, b: Asset): number {
  if (a.at > b.at) {
    return 1;
  } else if (a.at < b.at) {
    return -1;
  } else if (a.id > b.id) {
    // This should never happen, but fall
    // back to it to get stable sorting.
    return 1;
  } else {
    return -1;
  }
}
