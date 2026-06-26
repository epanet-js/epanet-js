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
    if (!pipe.material || !pipe.year) continue;

    const entries = materialMap.get(pipe.material);
    if (!entries) continue;

    const pipeAge = Math.max(0, currentYear - pipe.year);
    const roughness = findRoughness(entries, pipeAge);
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
  let result: number | null = null;
  for (const entry of entries) {
    result = entry.roughness;
    if (entry.age! >= pipeAge) break;
  }
  return result;
};
