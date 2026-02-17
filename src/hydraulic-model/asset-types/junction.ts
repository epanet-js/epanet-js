import { Node, NodeProperties } from "./node";

export type JunctionProperties = {
  type: "junction";
} & NodeProperties;

export const junctionQuantities = ["elevation", "pressure"] as const;
export type JunctionQuantity = (typeof junctionQuantities)[number];

export class Junction extends Node<JunctionProperties> {
  getUnit(key: JunctionQuantity) {
    return this.units[key];
  }

  copy() {
    const newJunction = new Junction(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );

    return newJunction;
  }
}
