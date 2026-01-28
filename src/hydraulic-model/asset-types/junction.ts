import { Node, NodeProperties } from "./node";
import { CustomerPointsLookup } from "../customer-points-lookup";
import {
  JunctionDemand,
  DemandPatterns,
  calculateAverageDemand,
} from "../demands";

export type JunctionProperties = {
  type: "junction";
  demands: JunctionDemand[];
} & NodeProperties;

export const junctionQuantities = ["elevation", "pressure"] as const;
export type JunctionQuantity = (typeof junctionQuantities)[number];

export type JunctionSimulation = {
  pressure: number;
  head: number;
  demand: number;
};

export class Junction extends Node<JunctionProperties> {
  private simulation: JunctionSimulation | null = null;

  get constantDemand() {
    return this.properties.demands
      .filter((d) => !d.patternId)
      .reduce((sum, d) => sum + d.baseDemand, 0);
  }

  get demands(): JunctionDemand[] {
    return this.properties.demands;
  }

  setDemands(demands: JunctionDemand[]) {
    this.properties.demands = demands;
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

  getTotalCustomerDemand(
    customerPointsLookup: CustomerPointsLookup,
    patterns: DemandPatterns,
  ): number {
    const connectedCustomerPoints = customerPointsLookup.getCustomerPoints(
      this.id,
    );

    return Array.from(connectedCustomerPoints).reduce(
      (sum, cp) => sum + calculateAverageDemand(cp.demands, patterns),
      0,
    );
  }

  copy() {
    const newJunction = new Junction(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
        demands: this.properties.demands.map((d) => ({ ...d })),
      },
      this.units,
    );

    return newJunction;
  }
}
