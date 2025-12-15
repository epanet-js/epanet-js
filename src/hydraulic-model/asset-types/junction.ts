import { Node, NodeProperties } from "./node";
import { CustomerPointsLookup } from "../customer-points-lookup";
import { JunctionDemand } from "../demands";

export type JunctionProperties = {
  type: "junction";
  baseDemand: number;
  demands: JunctionDemand[];
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

  setBaseDemand(value: number) {
    this.properties.baseDemand = value;
  }

  get demands(): JunctionDemand[] {
    return this.properties.demands;
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

  getTotalCustomerDemand(customerPointsLookup: CustomerPointsLookup): number {
    const connectedCustomerPoints = customerPointsLookup.getCustomerPoints(
      this.id,
    );

    return Array.from(connectedCustomerPoints).reduce(
      (sum, cp) => sum + cp.baseDemand,
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
