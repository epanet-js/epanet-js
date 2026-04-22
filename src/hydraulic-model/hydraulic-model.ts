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
  assets,
  topology,
  assetIndex,
  customerPoints,
  customerPointsLookup,
  patterns,
}: {
  demands?: Demands;
  controls?: Controls;
  idGenerator?: IdGenerator;
  assets?: AssetsMap;
  topology?: Topology;
  assetIndex?: AssetIndex;
  customerPoints?: CustomerPoints;
  customerPointsLookup?: CustomerPointsLookup;
  patterns?: Patterns;
} = {}): HydraulicModel => {
  const assetIdGenerator = idGenerator ?? new ConsecutiveIdsGenerator();
  const resolvedAssets = assets ?? new Map();
  return {
    version: nanoid(),
    assets: resolvedAssets,
    customerPoints: customerPoints ?? initializeCustomerPoints(),
    customerPointsLookup: customerPointsLookup ?? new CustomerPointsLookup(),
    topology: topology ?? new Topology(),
    assetIndex: assetIndex ?? new AssetIndex(assetIdGenerator, resolvedAssets),
    demands,
    curves: new Map(),
    patterns: patterns ?? new Map(),
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
    demands: {
      junctions: new Map(source.demands.junctions),
      customerPoints: new Map(source.demands.customerPoints),
    },
    curves: new Map(source.curves),
    patterns: new Map(source.patterns),
    controls: { ...source.controls },
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
