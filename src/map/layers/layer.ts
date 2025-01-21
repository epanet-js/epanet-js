export type LayerId =
  | "pipes"
  | "imported-pipes"
  | "junctions"
  | "imported-junctions"
  | "junction-results"
  | "imported-junction-results"
  | "imported-pipe-arrows"
  | "pipe-arrows"
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
];

export const clickableLayers: LayerId[] = assetLayers;
