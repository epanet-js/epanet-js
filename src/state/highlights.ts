import { atom } from "jotai";
import type { AssetId } from "src/hydraulic-model";

export type MarkerHighlight = {
  type: "marker";
  coordinates: [number, number];
  nodeType?: "junction" | "tank" | "reservoir";
  linkType?: "pipe" | "pump" | "valve";
};

export type AssetHighlight = {
  type: "asset";
  assetId: AssetId;
};

export type Highlight = MarkerHighlight | AssetHighlight;

export const highlightsAtom = atom<Highlight[]>([]);
