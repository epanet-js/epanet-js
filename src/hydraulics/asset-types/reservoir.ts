import { Node, NodeProperties } from "./node";
import { QuantityProperty } from "./base-asset";
import { QuantitiesSpec } from "src/quantity";

export type ReservoirProperties = {
  type: "reservoir";
  head: number;
} & NodeProperties;

export type ReservoirQuantities = Pick<
  ReservoirProperties,
  "elevation" | "head"
>;

export type ReservoirExplain = Record<
  keyof ReservoirQuantities,
  QuantityProperty
>;

const canonicalSpec: QuantitiesSpec<ReservoirQuantities> = {
  elevation: { defaultValue: 0, unit: "m" },
  head: { defaultValue: 30, unit: "m" },
};
export { canonicalSpec as reservoirCanonicalSpec };

export class Reservoir extends Node<ReservoirProperties> {
  copy() {
    return new Reservoir(this.id, [...this.coordinates], {
      ...this.properties,
    });
  }

  explain(): ReservoirExplain {
    return {
      elevation: {
        type: "quantity",
        value: this.properties.elevation,
        unit: canonicalSpec.elevation.unit,
      },
      head: {
        type: "quantity",
        value: this.properties.head,
        unit: canonicalSpec.head.unit,
      },
    };
  }
}
