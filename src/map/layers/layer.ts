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
  | "imported-reservoirs-selected";

export const assetLayers: LayerId[] = [
  "pipes",
  "imported-pipes",
  "junctions",
  "imported-junctions",
  "junction-results",
  "imported-junction-results",
  "reservoirs",
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
];

export const clickableLayers: LayerId[] = assetLayers;
