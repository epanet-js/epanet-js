import type { AssetsMap } from "@epanet-js/hydraulic-model";
import { Pipe } from "@epanet-js/hydraulic-model";

// Every library material, plus the materials used by pipes that the library
// does not already cover. Matching is case-insensitive and the library label
// wins, so a pipe labelled `iron` against a library `Iron` never adds a second
// option the user could spread to more pipes.
export const listPipeMaterials = (
  assets: AssetsMap,
  libraryLabels: string[] = [],
): string[] => {
  const byKey = new Map<string, string>();
  for (const label of libraryLabels) {
    const key = label.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, label);
  }
  for (const asset of assets.values()) {
    if (asset.type !== "pipe") continue;
    const material = (asset as Pipe).material;
    if (!material) continue;
    const key = material.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, material);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
};
