export type LayerId =
  | "pipes"
  | "imported-pipes"
  | "junctions"
  | "imported-junctions"
  | "junction-results"
  | "imported-junction-results"
  | "imported-pipe-arrows"
  | "pipe-arrows"
  | "imported-pump-lines"
  | "pump-lines"
  | "imported-valve-lines"
  | "valve-lines"
  | "imported-pump-icons"
  | "pump-icons"
  | "valve-icons-control-valves"
  | "valve-icons-isolation-valves"
  | "reservoirs"
  | "imported-reservoirs"
  | "reservoirs-selected"
  | "imported-reservoirs-selected"
  | "icons-tanks"
  | "icons-reservoirs";

export const assetLayers: LayerId[] = [
  "pipes",
  "imported-pipes",
  "junctions",
  "imported-junctions",
  "junction-results",
  "imported-junction-results",
  "reservoirs",
  "icons-reservoirs",
  "reservoirs-selected",
  "imported-reservoirs",
  "imported-reservoirs-selected",
  "imported-pump-lines",
  "pump-lines",
  "pump-icons",
  "valve-icons-control-valves",
  "valve-icons-isolation-valves",
  "imported-valve-lines",
  "valve-lines",
  "icons-tanks",
];

export const clickableLayers: LayerId[] = assetLayers;

export const editingLayers: string[] = [
  ...assetLayers,
  "imported-pipe-arrows",
  "pipe-arrows",
  "imported-features-link-labels",
  "features-link-labels",
  "imported-features-node-labels",
  "features-node-labels",
  "check-valve-icons",
];
