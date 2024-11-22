import { Node, NodeAttributes } from "./node";
import { AssetQuantitiesSpec } from "./asset-quantities";
import { QuantityAttribute } from "./base-asset";

export type JunctionAttributes = {
  type: "junction";
  demand: number;
} & NodeAttributes;

export type JunctionQuantities = Pick<
  JunctionAttributes,
  "demand" | "elevation"
>;
export type JunctionExplain = Record<
  keyof JunctionQuantities,
  QuantityAttribute
>;

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
        type: "quantity",
        value: this.attributes.elevation,
        unit: canonicalSpec.elevation.unit,
      },
      demand: {
        type: "quantity",
        value: this.attributes.demand,
        unit: canonicalSpec.demand.unit,
      },
    };
  }
}
