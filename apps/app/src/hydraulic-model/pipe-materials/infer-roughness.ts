import type { Pipe } from "@epanet-js/hydraulic-model";
import type { PipeMaterial, RoughnessEntry } from "@epanet-js/hydraulic-model";
import { isValidInstallationYear } from "src/hydraulic-model/property-validators";

export type RoughnessInferrer = (pipe: Pipe) => number | null;

export const inferredRoughness = (
  pipe: Pipe,
  materials: PipeMaterial[],
): number | null => {
  if (!pipe.material) return null;
  if (pipe.year !== undefined && !isValidInstallationYear(pipe.year))
    return null;

  const { entriesByLabel, currentYear } = materialIndex(materials);
  const entries = entriesByLabel.get(pipe.material);
  if (!entries) return null;

  if (entries.length === 1) return entries[0].roughness;
  if (!pipe.year) return null;

  return findRoughness(entries, Math.max(0, currentYear - pipe.year));
};

export const effectiveRoughness = (
  pipe: Pipe,
  materials: PipeMaterial[],
): number | null => pipe.roughness ?? inferredRoughness(pipe, materials);

export const buildRoughnessInferrer = (
  materials: PipeMaterial[],
  { enabled }: { enabled: boolean },
): RoughnessInferrer =>
  enabled ? (pipe) => inferredRoughness(pipe, materials) : () => null;

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

type MaterialIndex = {
  entriesByLabel: Map<string, RoughnessEntry[]>;
  currentYear: number;
};

// Keyed on the materials array itself: the hydraulic model replaces it whenever
// the library changes, so the cache invalidates on its own. Without it every
// pipe of a large model would rebuild the index on each read.
const indexCache = new WeakMap<PipeMaterial[], MaterialIndex>();

const materialIndex = (materials: PipeMaterial[]): MaterialIndex => {
  const cached = indexCache.get(materials);
  if (cached) return cached;

  const entriesByLabel = new Map<string, RoughnessEntry[]>();
  for (const material of materials) {
    const sorted = material.entries
      .filter((entry) => entry.age !== null && entry.roughness !== null)
      .sort((a, b) => a.age! - b.age!);
    if (sorted.length > 0) entriesByLabel.set(material.label, sorted);
  }

  const index = { entriesByLabel, currentYear: new Date().getFullYear() };
  indexCache.set(materials, index);
  return index;
};
