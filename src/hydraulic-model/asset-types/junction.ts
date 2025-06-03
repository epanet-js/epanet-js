import { Node, NodeProperties } from "./node";

export type JunctionProperties = {
  type: "junction";
  baseDemand: number;
} & NodeProperties;

export const junctionQuantities = [
  "baseDemand",
  "elevation",
  "pressure",
] as const;
export type JunctionQuantity = (typeof junctionQuantities)[number];

export type JunctionSimulation = {
  pressure: number;
  head: number;
  demand: number;
};

export class Junction extends Node<JunctionProperties> {
  private simulation: JunctionSimulation | null = null;

  get baseDemand() {
    return this.properties.baseDemand;
  }

  get pressure() {
    if (!this.simulation) return null;

    return this.simulation.pressure;
  }

  get head() {
    if (!this.simulation) return null;

    return this.simulation.head;
  }

  get actualDemand() {
    if (!this.simulation) return null;

    return this.simulation.demand;
  }

  setSimulation(simulation: JunctionSimulation | null) {
    this.simulation = simulation;
  }

  getUnit(key: JunctionQuantity) {
    return this.units[key];
  }

  copy() {
    return new Junction(
      this.id,
      [...this.coordinates],
      { ...this.properties },
      this.units,
    );
  }
}
