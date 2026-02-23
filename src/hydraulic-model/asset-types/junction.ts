import { Node, NodeProperties } from "./node";

export type JunctionProperties = {
  type: "junction";
  emitterCoefficient: number;
} & NodeProperties;

export const junctionQuantities = [
  "elevation",
  "emitterCoefficient",
  "pressure",
] as const;
export type JunctionQuantity = (typeof junctionQuantities)[number];

export class Junction extends Node<JunctionProperties> {
  get emitterCoefficient() {
    return this.properties.emitterCoefficient;
  }

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
