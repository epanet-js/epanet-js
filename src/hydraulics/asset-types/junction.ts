import { Position } from "geojson";
import { AssetId } from "./base-asset";
import { Node, NodeAttributes } from "./node";
import { newFeatureId } from "src/lib/id";
import { Quantity, QuantityOrNumberMap } from "src/quantity";
import { AssetQuantitiesSpec, createCanonicalMap } from "./asset-quantities";

export type JunctionAttributes = {
  type: "junction";
  demand: number;
} & NodeAttributes;

export type JunctionQuantities = Pick<
  JunctionAttributes,
  "demand" | "elevation"
>;
export type JunctionExplain = Record<
  keyof Omit<JunctionAttributes, "type" | "visibility">,
  Quantity
>;

export type JunctionBuildData = {
  id?: AssetId;
  coordinates?: Position;
} & Partial<QuantityOrNumberMap<JunctionQuantities>>;

const canonicalSpec: AssetQuantitiesSpec<JunctionQuantities> = {
  elevation: { defaultValue: 0, unit: "m" },
  demand: { defaultValue: 0, unit: "l/s" },
};
export { canonicalSpec as junctionQuantitiesSpec };
const toCanonical = createCanonicalMap(canonicalSpec);

export class Junction extends Node<JunctionAttributes> {
  static build({
    id = newFeatureId(),
    coordinates = [0, 0],
    ...quantities
  }: JunctionBuildData = {}) {
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

  explain(): JunctionExplain {
    return {
      elevation: {
        value: this.attributes.elevation,
        unit: canonicalSpec.elevation.unit,
      },
      demand: {
        value: this.attributes.demand,
        unit: canonicalSpec.demand.unit,
      },
    };
  }
}
