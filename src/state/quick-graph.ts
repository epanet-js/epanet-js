import { atomWithStorage } from "jotai/utils";
import type {
  NodeProperty,
  LinkProperty,
} from "src/simulation/epanet/eps-results-reader";

export type AssetType =
  | "junction"
  | "pipe"
  | "pump"
  | "valve"
  | "tank"
  | "reservoir";

export type QuickGraphProperty =
  | NodeProperty
  | LinkProperty
  | "volume"
  | "level";

// Persist open/closed state of the quick graph section
export const quickGraphOpenAtom = atomWithStorage<boolean>(
  "quickGraphOpen",
  true,
);

// Pin state - keeps graph visible when scrolling and persists when switching assets
export const quickGraphPinnedAtom = atomWithStorage<boolean>(
  "quickGraphPinned",
  false,
);

// Selected property per asset type (persisted)
export const quickGraphPropertyAtom = atomWithStorage<
  Record<AssetType, QuickGraphProperty>
>("quickGraphProperty", {
  junction: "pressure",
  pipe: "flow",
  pump: "flow",
  valve: "flow",
  tank: "level",
  reservoir: "head",
});

// Property options for each asset type
export const QUICK_GRAPH_PROPERTIES: Record<
  AssetType,
  { value: QuickGraphProperty; labelKey: string }[]
> = {
  junction: [
    { value: "pressure", labelKey: "pressure" },
    { value: "head", labelKey: "head" },
    { value: "demand", labelKey: "actualDemand" },
  ],
  pipe: [
    { value: "flow", labelKey: "flow" },
    { value: "velocity", labelKey: "velocity" },
    { value: "headloss", labelKey: "unitHeadloss" },
  ],
  pump: [
    { value: "flow", labelKey: "flow" },
    { value: "headloss", labelKey: "pumpHead" },
  ],
  valve: [
    { value: "flow", labelKey: "flow" },
    { value: "velocity", labelKey: "velocity" },
    { value: "headloss", labelKey: "headlossShort" },
  ],
  tank: [
    { value: "level", labelKey: "level" },
    { value: "volume", labelKey: "volume" },
    { value: "pressure", labelKey: "pressure" },
  ],
  reservoir: [{ value: "head", labelKey: "head" }],
};
