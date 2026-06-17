import { Topology } from "@epanet-js/hydraulic-model";
import { AssetsMap } from "@epanet-js/hydraulic-model";
import { nanoid } from "nanoid";

import { ConsecutiveIdsGenerator, IdGenerator } from "@epanet-js/id-generator";
import { Demands, createEmptyDemands } from "@epanet-js/hydraulic-model";
import {
  CustomerPoints,
  initializeCustomerPoints,
  CustomerPointsLookup,
  Asset,
  Curves,
  Patterns,
} from "@epanet-js/hydraulic-model";
import { AssetIndex } from "@epanet-js/hydraulic-model";
import {
  RawControls,
  createEmptyRawControls,
} from "@epanet-js/hydraulic-model";
import { Controls, createEmptyControls } from "@epanet-js/hydraulic-model";

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
  rawControls: RawControls;
  controls: Controls;
};

export { AssetsMap };

export const initializeHydraulicModel = ({
  demands = createEmptyDemands(),
  rawControls = createEmptyRawControls(),
  controls = createEmptyControls(),
  idGenerator,
  assets,
  topology,
  assetIndex,
  customerPoints,
  customerPointsLookup,
  patterns,
  curves,
}: {
  demands?: Demands;
  rawControls?: RawControls;
  controls?: Controls;
  idGenerator?: IdGenerator;
  assets?: AssetsMap;
  topology?: Topology;
  assetIndex?: AssetIndex;
  customerPoints?: CustomerPoints;
  customerPointsLookup?: CustomerPointsLookup;
  patterns?: Patterns;
  curves?: Curves;
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
    curves: curves ?? new Map(),
    patterns: patterns ?? new Map(),
    rawControls,
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
    rawControls: { ...source.rawControls },
    controls: source.controls.map((control) => ({ ...control })),
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
