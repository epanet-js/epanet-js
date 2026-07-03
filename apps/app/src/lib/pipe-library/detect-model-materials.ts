import type { Pipe, AssetsMap } from "@epanet-js/hydraulic-model";
import type { PipeMaterial, RoughnessEntry } from "@epanet-js/pipe-library";
import type { ImportPipeLibraryResult } from "./import-from-file";

const AGE_STEP = 10;

const isValidInstallationYear = (year: number): boolean =>
  Number.isInteger(year) && year >= 1000 && year <= 9999;

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
  const rawAges = new Map<string, Set<number>>();
  const currentYear = new Date().getFullYear();

  for (const [, asset] of assets) {
    if (asset.type !== "pipe") continue;
    const pipe = asset as Pipe;
    if (!pipe.material) continue;

    let ages = rawAges.get(pipe.material);
    if (!ages) {
      ages = new Set();
      rawAges.set(pipe.material, ages);
    }

    if (pipe.year !== undefined && isValidInstallationYear(pipe.year)) {
      ages.add(Math.max(0, currentYear - pipe.year));
    }
  }

  if (rawAges.size === 0) {
    return { status: "success", pipeLibrary: [], errors: [] };
  }

  const pipeLibrary: PipeMaterial[] = [...rawAges.entries()]
    .map(([label, ages]) => {
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
