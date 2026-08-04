import type { AssetId } from "@epanet-js/hydraulic-model";
import type { Pipe, HydraulicModel } from "src/hydraulic-model";
import { inferredRoughness } from "src/hydraulic-model/pipe-materials";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";

export type RoughnessAssignment = { assetIds: AssetId[]; roughness: number };

export const roughnessAssignments = (
  hydraulicModel: HydraulicModel,
  materials: PipeMaterial[],
): RoughnessAssignment[] => {
  const roughnessGroups = new Map<number, AssetId[]>();

  for (const [assetId, asset] of hydraulicModel.assets) {
    if (asset.type !== "pipe") continue;
    const pipe = asset as Pipe;
    if (pipe.roughness != null) continue;

    const roughness = inferredRoughness(pipe, materials);
    if (roughness == null) continue;

    const group = roughnessGroups.get(roughness);
    if (group) group.push(assetId);
    else roughnessGroups.set(roughness, [assetId]);
  }

  return [...roughnessGroups.entries()].map(([roughness, assetIds]) => ({
    assetIds,
    roughness,
  }));
};
