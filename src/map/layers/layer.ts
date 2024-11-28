export type LayerId =
  | "pipes"
  | "imported-pipes"
  | "junctions"
  | "imported-junctions"
  | "reservoirs"
  | "imported-reservoirs"
  | "reservoirs-selected"
  | "imported-reservoirs-selected";

export const assetLayers: LayerId[] = [
  "pipes",
  "imported-pipes",
  "junctions",
  "imported-junctions",
  "reservoirs",
  "reservoirs-selected",
  "imported-reservoirs",
  "imported-reservoirs-selected",
];

export const clickableLayers = assetLayers;
