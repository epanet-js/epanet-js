import { Node, NodeProperties } from "./node";

export const DEFAULT_EMITTER_COEFFICIENT = 0;

export type JunctionProperties = {
  type: "junction";
  emitterCoefficient?: number;
} & NodeProperties;

export const junctionQuantities = [
  "elevation",
  "emitterCoefficient",
  "initialQuality",
  "pressure",
] as const;
export type JunctionQuantity = (typeof junctionQuantities)[number];

export class Junction extends Node<JunctionProperties> {
  get emitterCoefficient() {
    return this.properties.emitterCoefficient;
  }

  copy() {
    const newJunction = new Junction(this.id, [...this.coordinates], {
      ...this.properties,
    });

    return newJunction;
  }
}
