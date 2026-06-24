import type { AssetsMap } from "@epanet-js/hydraulic-model";
import { Pipe } from "@epanet-js/hydraulic-model";
import type { PipeMaterial } from "src/lib/pipe-library";

// Returns distinct pipe materials across the model and the pipe library,
// case-insensitive-deduped (first-seen casing wins), sorted case-insensitively.
export const listPipeMaterials = (
  assets: AssetsMap,
  libraryMaterials: PipeMaterial[] = [],
): string[] => {
  const seen = new Map<string, string>();
  for (const asset of assets.values()) {
    if (asset.type !== "pipe") continue;
    const m = (asset as Pipe).material;
    if (!m) continue;
    const key = m.toLowerCase();
    if (!seen.has(key)) seen.set(key, m);
  }
  for (const lm of libraryMaterials) {
    const key = lm.label.toLowerCase();
    if (!seen.has(key)) seen.set(key, lm.label);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
};
