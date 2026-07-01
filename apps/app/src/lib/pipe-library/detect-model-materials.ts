import type { Pipe, AssetsMap } from "@epanet-js/hydraulic-model";

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

export type DetectedMaterial = {
  label: string;
  ages: Set<number>;
};

export const detectModelMaterials = (assets: AssetsMap): DetectedMaterial[] => {
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

  return [...rawAges.entries()]
    .map(([label, ages]) => ({
      label,
      ages: bucketByDecade(ages),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};
