export type LayerId =
  | "delta-features-pipes"
  | "main-features-pipes"
  | "selected-pipes"
  | "delta-features-junctions"
  | "main-features-junctions"
  | "selected-junctions"
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
  | "icons-reservoirs"
  | "zones-fill"
  | "zones-outline"
  | "zones-labels"
  // Faceted path (FLAG_MAP_FACETED_SOURCES): delta icon facet + delta selection
  // overlay. `icons` is the main icon facet; these mirror it for the delta live-set.
  | "delta-icons-pump-icons"
  | "delta-icons-valve-icons-control-valves"
  | "delta-icons-valve-icons-isolation-valves"
  | "delta-icons-tanks"
  | "delta-icons-reservoirs"
  | "delta-selected-pipes"
  | "delta-selected-pump-lines"
  | "delta-selected-valve-lines"
  | "delta-selected-junctions"
  | "delta-selected-icons"
  | "delta-selected-icons-halo"
  | "delta-selected-pipe-arrows";

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
  // Faceted path: delta icons must be clickable/selectable like the main icons.
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
