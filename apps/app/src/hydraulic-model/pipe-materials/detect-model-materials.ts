import type { Pipe, AssetsMap } from "@epanet-js/hydraulic-model";
import type { PipeMaterial, RoughnessEntry } from "@epanet-js/hydraulic-model";
import { isValidInstallationYear } from "src/hydraulic-model/property-validators";
import type { ImportPipeLibraryResult } from "./import-result";

const AGE_STEP = 10;

const bucketByDecade = (ages: Set<number>): Set<number> => {
  const buckets = new Set<number>();
  for (const age of ages) {
    buckets.add(Math.floor(age / AGE_STEP) * AGE_STEP);
  }
  return buckets;
};

export const detectModelMaterials = (
  assets: AssetsMap,
  defaultRoughness: number,
): ImportPipeLibraryResult => {
  // Labels differing only by case are merged into one material, unlike an
  // imported file where they are reported: these are the model's own pipes, and
  // two casings there are the mismatch this detection exists to collapse.
  const rawAges = new Map<string, { label: string; ages: Set<number> }>();
  const currentYear = new Date().getFullYear();

  for (const [, asset] of assets) {
    if (asset.type !== "pipe") continue;
    const pipe = asset as Pipe;
    if (!pipe.material) continue;

    const key = pipe.material.toLowerCase();
    let detected = rawAges.get(key);
    if (!detected) {
      detected = { label: pipe.material, ages: new Set() };
      rawAges.set(key, detected);
    }

    if (pipe.year !== undefined && isValidInstallationYear(pipe.year)) {
      detected.ages.add(Math.max(0, currentYear - pipe.year));
    }
  }

  if (rawAges.size === 0) {
    return { status: "success", pipeLibrary: [], errors: [] };
  }

  const pipeLibrary: PipeMaterial[] = [...rawAges.values()]
    .map(({ label, ages }) => {
      const buckets = bucketByDecade(ages);
      const entries: RoughnessEntry[] = [
        { age: 0, roughness: defaultRoughness },
      ];
      for (const age of buckets) {
        if (age !== 0) {
          entries.push({ age, roughness: defaultRoughness });
        }
      }
      entries.sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
      return { label, entries };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return { status: "success", pipeLibrary, errors: [] };
};
