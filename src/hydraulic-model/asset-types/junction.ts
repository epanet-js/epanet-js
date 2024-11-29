import { Node, NodeProperties } from "./node";
import { QuantityProperty } from "./base-asset";
import { QuantitiesSpec } from "src/quantity";

export type JunctionProperties = {
  type: "junction";
  demand: number;
} & NodeProperties;

export type JunctionQuantities = Pick<
  JunctionProperties,
  "demand" | "elevation"
>;
export type JunctionExplain = Record<
  keyof JunctionQuantities,
  QuantityProperty
>;

const canonicalSpec: QuantitiesSpec<JunctionQuantities> = {
  elevation: { defaultValue: 0, unit: "m" },
  demand: { defaultValue: 0, unit: "l/s" },
};
export { canonicalSpec as junctionCanonicalSpec };

export class Junction extends Node<JunctionProperties> {
  get demand() {
    return this.properties.demand;
  }

  copy() {
    return new Junction(this.id, [...this.coordinates], { ...this.properties });
  }

  explain(): JunctionExplain {
    return {
      elevation: {
        type: "quantity",
        value: this.properties.elevation,
        unit: canonicalSpec.elevation.unit,
      },
      demand: {
        type: "quantity",
        value: this.properties.demand,
        unit: canonicalSpec.demand.unit,
      },
    };
  }
}
