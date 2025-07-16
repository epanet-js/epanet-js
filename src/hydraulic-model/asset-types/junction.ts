import { Node, NodeProperties } from "./node";
import { CustomerPoint } from "../customer-points";

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
  private assignedCustomerPoints: Set<CustomerPoint> = new Set();

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

  get customerPoints(): CustomerPoint[] {
    return Array.from(this.assignedCustomerPoints);
  }

  get customerPointCount(): number {
    return this.assignedCustomerPoints.size;
  }

  assignCustomerPoint(customerPoint: CustomerPoint): void {
    this.assignedCustomerPoints.add(customerPoint);
  }

  removeCustomerPoint(customerPoint: CustomerPoint): void {
    this.assignedCustomerPoints.delete(customerPoint);
  }

  get totalCustomerDemand(): number {
    return this.customerPoints.reduce((sum, cp) => sum + cp.baseDemand, 0);
  }

  copy() {
    const newJunction = new Junction(
      this.id,
      [...this.coordinates],
      { ...this.properties },
      this.units,
    );

    this.assignedCustomerPoints.forEach((cp) => {
      newJunction.assignCustomerPoint(cp);
    });

    return newJunction;
  }
}
