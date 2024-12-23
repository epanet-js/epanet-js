import { Node, NodeProperties } from "./node";

export type ReservoirProperties = {
  type: "reservoir";
  head: number;
} & NodeProperties;

export type ReservoirQuantity = "elevation" | "head" | "relativeHead";

export class Reservoir extends Node<ReservoirProperties> {
  copy() {
    return new Reservoir(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );
  }

  setSimulation() {}

  getUnit(key: ReservoirQuantity) {
    return this.units[key];
  }

  get head() {
    return this.properties.head;
  }

  setHead(value: number) {
    this.properties.head = value;
  }
}
