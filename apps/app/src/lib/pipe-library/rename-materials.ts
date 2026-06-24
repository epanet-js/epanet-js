import type { AssetId } from "@epanet-js/hydraulic-model";
import type { Pipe, HydraulicModel } from "src/hydraulic-model";
import type {
  AssetPatch,
  ModelMoment,
} from "src/hydraulic-model/model-operation";
import { changeProperty } from "src/hydraulic-model/model-operations/change-property";

export const renameMaterialsMoment = (
  hydraulicModel: HydraulicModel,
  renames: ReadonlyMap<string, string>,
): ModelMoment => {
  const groups = new Map<string, AssetId[]>();

  for (const [assetId, asset] of hydraulicModel.assets) {
    if (asset.type !== "pipe") continue;
    const pipe = asset as Pipe;
    if (!pipe.material) continue;

    const newLabel = renames.get(pipe.material);
    if (newLabel == null || newLabel === pipe.material) continue;

    let group = groups.get(newLabel);
    if (!group) {
      group = [];
      groups.set(newLabel, group);
    }
    group.push(assetId);
  }

  const patches: AssetPatch[] = [];
  for (const [newLabel, assetIds] of groups) {
    const moment = changeProperty(hydraulicModel, {
      assetIds,
      property: "material",
      value: newLabel,
    });
    patches.push(...moment.patchAssetsAttributes!);
  }

  return {
    note: "Rename pipe materials",
    patchAssetsAttributes: patches,
  };
};
