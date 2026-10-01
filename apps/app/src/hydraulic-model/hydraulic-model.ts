import {
  AssetsMap,
  Asset,
  buildControlsLookup,
  deepCloneCustomAttributes,
  type HydraulicModel,
} from "@epanet-js/hydraulic-model";

export type { HydraulicModel };
export { AssetsMap };
export { initializeHydraulicModel } from "@epanet-js/hydraulic-model";

export const copyModel = (source: HydraulicModel): HydraulicModel => {
  const assets: AssetsMap = new Map(source.assets);
  const controls = source.controls.map((control) => ({ ...control }));

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
    pipeMaterials: [...source.pipeMaterials],
    rawControls: { ...source.rawControls },
    controls,
    controlsLookup: buildControlsLookup(controls),
    customAttributes: deepCloneCustomAttributes(source.customAttributes),
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
