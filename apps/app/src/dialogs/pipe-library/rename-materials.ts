import type { AssetId } from "@epanet-js/hydraulic-model";
import type { Pipe, HydraulicModel } from "src/hydraulic-model";

export type MaterialRenameAssignment = {
  assetIds: AssetId[];
  material: string;
};

export const renameAssignments = (
  hydraulicModel: HydraulicModel,
  renames: ReadonlyMap<string, string>,
): MaterialRenameAssignment[] => {
  const renamesByKey = new Map<string, string>();
  for (const [oldLabel, newLabel] of renames) {
    renamesByKey.set(oldLabel.toLowerCase(), newLabel);
  }

  const groups = new Map<string, AssetId[]>();

  for (const [assetId, asset] of hydraulicModel.assets) {
    if (asset.type !== "pipe") continue;
    const pipe = asset as Pipe;
    if (!pipe.material) continue;

    const newLabel = renamesByKey.get(pipe.material.toLowerCase());
    if (newLabel == null || newLabel === pipe.material) continue;

    let group = groups.get(newLabel);
    if (!group) {
      group = [];
      groups.set(newLabel, group);
    }
    group.push(assetId);
  }

  return [...groups.entries()].map(([material, assetIds]) => ({
    assetIds,
    material,
  }));
};
