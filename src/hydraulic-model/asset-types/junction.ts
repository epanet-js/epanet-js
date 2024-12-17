import { isFeatureOn } from "src/infra/feature-flags";
import { Node, NodeProperties } from "./node";
import { QuantitiesSpec } from "src/quantity";

export type JunctionProperties = {
  type: "junction";
  demand: number;
} & NodeProperties;

export type JunctionQuantities = Pick<
  JunctionProperties,
  "demand" | "elevation"
> & { pressure: number };

const canonicalSpec: QuantitiesSpec<JunctionQuantities> = {
  elevation: { defaultValue: 0, unit: "m" },
  demand: {
    defaultValue: isFeatureOn("FLAG_DEFAULT_DEMAND") ? 1 : 0,
    unit: "l/s",
  },
  pressure: { defaultValue: 0, unit: "mwc" },
};

export { canonicalSpec as junctionCanonicalSpec };

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

  copy() {
    return new Junction(this.id, [...this.coordinates], { ...this.properties });
  }
}
