import { Topology } from "./topology";
import { AssetsMap } from "./assets-map";
import { nanoid } from "nanoid";

import { ConsecutiveIdsGenerator, IdGenerator } from "src/lib/id-generator";
import { Demands, createEmptyDemands } from "./demands";
import { CustomerPoints, initializeCustomerPoints } from "./customer-points";
import { CustomerPointsLookup } from "./customer-points-lookup";
import { AssetIndex } from "./asset-index";
import { Asset } from "./asset-types";
import { Curves } from "./curves";
import { Controls, createEmptyControls } from "./controls";
import { Patterns } from "./patterns";

export type HydraulicModel = {
  version: string;
  assets: AssetsMap;
  customerPoints: CustomerPoints;
  customerPointsLookup: CustomerPointsLookup;
  topology: Topology;
  assetIndex: AssetIndex;
  demands: Demands;
  curves: Curves;
  patterns: Patterns;
  controls: Controls;
};

export { AssetsMap };

export const initializeHydraulicModel = ({
  demands = createEmptyDemands(),
  controls = createEmptyControls(),
  idGenerator,
}: {
  demands?: Demands;
  controls?: Controls;
  idGenerator?: IdGenerator;
} = {}): HydraulicModel => {
  const assetIdGenerator = idGenerator ?? new ConsecutiveIdsGenerator();
  const assets = new Map();
  return {
    version: nanoid(),
    assets,
    customerPoints: initializeCustomerPoints(),
    customerPointsLookup: new CustomerPointsLookup(),
    topology: new Topology(),
    assetIndex: new AssetIndex(assetIdGenerator, assets),
    demands,
    curves: new Map(),
    patterns: new Map(),
    controls,
  };
};

export const copyModel = (source: HydraulicModel): HydraulicModel => {
  const assets: AssetsMap = new Map(source.assets);

  return {
    ...source,
    assets,
    customerPoints: new Map(source.customerPoints),
    customerPointsLookup: source.customerPointsLookup.copy(),
    topology: source.topology.copy(),
    assetIndex: source.assetIndex.copy(assets),
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
