import { Position } from "geojson";
import { AssetId } from "./base-asset";
import { Node, NodeAttributes } from "./node";
import { newFeatureId } from "src/lib/id";
import {
  QuantityMap,
  QuantityOrNumberMap,
  createCanonicalMap,
} from "src/quantity";

export type JunctionAttributes = {
  type: "junction";
  demand: number;
} & NodeAttributes;

type JunctionQuantities = Pick<JunctionAttributes, "demand" | "elevation">;

type BuildData = {
  id?: AssetId;
  coordinates?: Position;
} & Partial<QuantityOrNumberMap<JunctionQuantities>>;

const canonicalSpec: QuantityMap<JunctionQuantities> = {
  elevation: { value: 0, unit: "m" },
  demand: { value: 0, unit: "l/s" },
};
const toCanonical = createCanonicalMap(canonicalSpec);

export class Junction extends Node<JunctionAttributes> {
  static build({
    id = newFeatureId(),
    coordinates = [0, 0],
    ...quantities
  }: BuildData = {}) {
    return new Junction(id, coordinates, {
      type: "junction",
      elevation: toCanonical(quantities, "elevation"),
      demand: toCanonical(quantities, "demand"),
    });
  }

  get demand() {
    return this.attributes.demand;
  }

  copy() {
    return new Junction(this.id, [...this.coordinates], { ...this.attributes });
  }
}
