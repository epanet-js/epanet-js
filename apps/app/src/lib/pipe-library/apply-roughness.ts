import type { AssetId } from "@epanet-js/hydraulic-model";
import type { Pipe, HydraulicModel } from "src/hydraulic-model";
import type {
  AssetPatch,
  ModelMoment,
} from "src/hydraulic-model/model-operation";
import { changeProperty } from "src/hydraulic-model/model-operations/change-property";
import type { PipeMaterial, RoughnessEntry } from "@epanet-js/pipe-library";

export const applyRoughnessMoment = (
  hydraulicModel: HydraulicModel,
  materials: PipeMaterial[],
): ModelMoment => {
  const materialMap = new Map<string, RoughnessEntry[]>();
  for (const m of materials) {
    const sorted = m.entries
      .filter((e) => e.age !== null && e.roughness !== null)
      .sort((a, b) => a.age! - b.age!);
    if (sorted.length > 0) materialMap.set(m.label, sorted);
  }

  const currentYear = new Date().getFullYear();
  const roughnessGroups = new Map<number, AssetId[]>();

  for (const [assetId, asset] of hydraulicModel.assets) {
    if (asset.type !== "pipe") continue;
    const pipe = asset as Pipe;
    if (pipe.roughness != null) continue;
    if (!pipe.material) continue;

    const entries = materialMap.get(pipe.material);
    if (!entries) continue;

    let roughness: number | null;
    if (entries.length === 1) {
      roughness = entries[0].roughness;
    } else {
      if (!pipe.year) continue;
      const pipeAge = Math.max(0, currentYear - pipe.year);
      roughness = findRoughness(entries, pipeAge);
    }
    if (roughness == null) continue;

    let group = roughnessGroups.get(roughness);
    if (!group) {
      group = [];
      roughnessGroups.set(roughness, group);
    }
    group.push(assetId);
  }

  const patches: AssetPatch[] = [];
  for (const [roughness, assetIds] of roughnessGroups) {
    const moment = changeProperty(hydraulicModel, {
      assetIds,
      property: "roughness",
      value: roughness,
    });
    patches.push(...moment.patchAssetsAttributes!);
  }

  return {
    note: "Apply roughness from pipe library",
    patchAssetsAttributes: patches,
  };
};

export const findRoughness = (
  entries: RoughnessEntry[],
  pipeAge: number,
): number | null => {
  if (entries.length === 0) return null;
  let result: number | null = entries[0].roughness;
  for (const entry of entries) {
    if (entry.age! > pipeAge) break;
    result = entry.roughness;
  }
  return result;
};
