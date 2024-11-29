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
> & { relativeHead: number };

export type ReservoirExplain = Record<
  keyof Omit<ReservoirQuantities, "relativeHead">,
  QuantityProperty
>;

const canonicalSpec: QuantitiesSpec<ReservoirQuantities> = {
  elevation: { defaultValue: 0, unit: "m" },
  relativeHead: { defaultValue: 10, unit: "m" },
  head: { defaultValue: 0, unit: "m" },
};
export { canonicalSpec as reservoirCanonicalSpec };

export class Reservoir extends Node<ReservoirProperties> {
  copy() {
    return new Reservoir(this.id, [...this.coordinates], {
      ...this.properties,
    });
  }

  get head() {
    return this.properties.head;
  }

  setHead(value: number) {
    this.properties.head = value;
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
