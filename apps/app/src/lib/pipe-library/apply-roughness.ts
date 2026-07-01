import type { AssetId } from "@epanet-js/hydraulic-model";
import type { Pipe, HydraulicModel } from "src/hydraulic-model";
import type {
  AssetPatch,
  ModelMoment,
} from "src/hydraulic-model/model-operation";
import { changeProperty } from "src/hydraulic-model/model-operations/change-property";
import { isValidInstallationYear } from "src/hydraulic-model/property-validators";
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
    if (pipe.roughness != null || !pipe.material) continue;
    if (pipe.year !== undefined && !isValidInstallationYear(pipe.year))
      continue;

    const entries = materialMap.get(pipe.material);
    if (!entries) continue;

    const roughness = resolveRoughness(pipe, entries, currentYear);
    if (roughness == null) continue;

    const group = roughnessGroups.get(roughness);
    if (group) group.push(assetId);
    else roughnessGroups.set(roughness, [assetId]);
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

const resolveRoughness = (
  pipe: Pipe,
  entries: RoughnessEntry[],
  currentYear: number,
): number | null => {
  if (entries.length === 1) return entries[0].roughness;
  if (!pipe.year) return null;
  const pipeAge = Math.max(0, currentYear - pipe.year);
  return findRoughness(entries, pipeAge);
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
