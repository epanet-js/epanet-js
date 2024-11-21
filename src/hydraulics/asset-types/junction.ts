import { Node, NodeAttributes } from "./node";
import { Quantity } from "src/quantity";
import { AssetQuantitiesSpec } from "./asset-quantities";

export type JunctionAttributes = {
  type: "junction";
  demand: number;
} & NodeAttributes;

export type JunctionQuantities = Pick<
  JunctionAttributes,
  "demand" | "elevation"
>;
export type JunctionExplain = Record<keyof JunctionQuantities, Quantity>;

const canonicalSpec: AssetQuantitiesSpec<JunctionQuantities> = {
  elevation: { defaultValue: 0, unit: "m" },
  demand: { defaultValue: 0, unit: "l/s" },
};
export { canonicalSpec as junctionCanonicalSpec };

export class Junction extends Node<JunctionAttributes> {
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
