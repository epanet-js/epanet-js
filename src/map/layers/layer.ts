import { isFeatureOn } from "src/infra/feature-flags";

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

export const clickableLayers: LayerId[] = isFeatureOn("FLAG_RESERVOIR")
  ? assetLayers
  : ["pipes", "imported-pipes", "junctions", "imported-junctions"];
