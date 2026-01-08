export type LayerId =
  | "delta-features-pipes"
  | "main-features-pipes"
  | "selected-pipes"
  | "delta-features-junctions"
  | "main-features-junctions"
  | "selected-junctions"
  | "delta-features-junction-results"
  | "main-features-junction-results"
  | "main-features-pipe-arrows"
  | "delta-features-pipe-arrows"
  | "selected-pipe-arrows"
  | "main-features-pump-lines"
  | "delta-features-pump-lines"
  | "selected-pump-lines"
  | "main-features-valve-lines"
  | "delta-features-valve-lines"
  | "selected-valve-lines"
  | "pump-icons"
  | "valve-icons-control-valves"
  | "valve-icons-isolation-valves"
  | "selected-icons"
  | "selected-icons-halo"
  | "icons-tanks"
  | "icons-reservoirs";

export const assetLayers: LayerId[] = [
  "delta-features-pipes",
  "main-features-pipes",
  "delta-features-junctions",
  "main-features-junctions",
  "delta-features-junction-results",
  "main-features-junction-results",
  "icons-reservoirs",
  "main-features-pump-lines",
  "delta-features-pump-lines",
  "pump-icons",
  "valve-icons-control-valves",
  "valve-icons-isolation-valves",
  "main-features-valve-lines",
  "delta-features-valve-lines",
  "icons-tanks",
];

export const clickableLayers: LayerId[] = assetLayers;

export const editingLayers: string[] = [
  ...assetLayers,
  "main-features-pipe-arrows",
  "delta-features-pipe-arrows",
  "main-features-link-labels",
  "delta-features-link-labels",
  "main-features-node-labels",
  "delta-features-node-labels",
  "check-valve-icons",
];
