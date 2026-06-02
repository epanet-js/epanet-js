import type { AssetsMap } from "../assets-map";
import { Pipe } from "@epanet-js/hydraulic-model";

// Returns distinct pipe materials across the model, case-insensitive-deduped
// (first-seen casing wins), sorted case-insensitively.
export const listPipeMaterials = (assets: AssetsMap): string[] => {
  const seen = new Map<string, string>();
  for (const asset of assets.values()) {
    if (asset.type !== "pipe") continue;
    const m = (asset as Pipe).material;
    if (!m) continue;
    const key = m.toLowerCase();
    if (!seen.has(key)) seen.set(key, m);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
};
