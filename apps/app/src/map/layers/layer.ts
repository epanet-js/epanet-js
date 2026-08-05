export type LayerId =
  | "delta-features-pipes"
  | "main-features-pipes"
  | "delta-features-junctions"
  | "main-features-junctions"
  | "main-features-pipe-arrows"
  | "delta-features-pipe-arrows"
  | "main-features-pump-lines"
  | "delta-features-pump-lines"
  | "main-features-valve-lines"
  | "delta-features-valve-lines"
  | "pump-icons"
  | "valve-icons-control-valves"
  | "valve-icons-isolation-valves"
  | "selected-icons-halo"
  | "icons-tanks"
  | "icons-reservoirs"
  | "zones-fill"
  | "zones-outline"
  | "zones-labels"
  // Delta icon facet: `icons` is the main icon facet; these mirror it for the delta
  // live-set. `delta-selected-icons-halo` is the delta selection halo.
  | "delta-icons-pump-icons"
  | "delta-icons-valve-icons-control-valves"
  | "delta-icons-valve-icons-isolation-valves"
  | "delta-icons-tanks"
  | "delta-icons-reservoirs"
  | "delta-selected-icons-halo";

export const assetLayers: LayerId[] = [
  "delta-features-pipes",
  "main-features-pipes",
  "delta-features-junctions",
  "main-features-junctions",
  "icons-reservoirs",
  "main-features-pump-lines",
  "delta-features-pump-lines",
  "pump-icons",
  "valve-icons-control-valves",
  "valve-icons-isolation-valves",
  "main-features-valve-lines",
  "delta-features-valve-lines",
  "icons-tanks",
  // Delta icons must be clickable/selectable like the main icons.
  "delta-icons-pump-icons",
  "delta-icons-valve-icons-control-valves",
  "delta-icons-valve-icons-isolation-valves",
  "delta-icons-tanks",
  "delta-icons-reservoirs",
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
