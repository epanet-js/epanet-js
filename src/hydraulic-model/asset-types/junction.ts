import { Node, NodeProperties } from "./node";

export type JunctionProperties = {
  type: "junction";
  demand: number;
} & NodeProperties;

export const junctionQuantities = ["demand", "elevation", "pressure"] as const;
export type JunctionQuantity = (typeof junctionQuantities)[number];

export interface JunctionSimulationProvider {
  getPressure: (id: string) => number | null;
}

export class Junction extends Node<JunctionProperties> {
  private simulation: JunctionSimulationProvider | null = null;

  get demand() {
    return this.properties.demand;
  }

  get pressure() {
    if (!this.simulation) return null;

    return this.simulation.getPressure(this.id);
  }

  setSimulation(simulation: JunctionSimulationProvider) {
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
