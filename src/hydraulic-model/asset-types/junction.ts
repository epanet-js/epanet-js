import { Node, NodeProperties } from "./node";
import { CustomerPoint, CustomerPoints } from "../customer-points";

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
  private assignedCustomerPointIds: Set<string> = new Set();

  get baseDemand() {
    return this.properties.baseDemand;
  }

  setBaseDemand(value: number) {
    this.properties.baseDemand = value;
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

  get customerPointIds(): string[] {
    return Array.from(this.assignedCustomerPointIds);
  }

  get customerPointCount(): number {
    return this.assignedCustomerPointIds.size;
  }

  assignCustomerPoint(customerPointId: string): void {
    this.assignedCustomerPointIds.add(customerPointId);
  }

  removeCustomerPoint(customerPointId: string): void {
    this.assignedCustomerPointIds.delete(customerPointId);
  }

  getTotalCustomerDemand(customerPoints: CustomerPoints): number {
    return Array.from(this.assignedCustomerPointIds)
      .map((id) => customerPoints.get(id))
      .filter((cp): cp is CustomerPoint => cp !== undefined)
      .reduce((sum, cp) => sum + cp.baseDemand, 0);
  }

  copy() {
    const newJunction = new Junction(
      this.id,
      [...this.coordinates],
      { ...this.properties },
      this.units,
    );

    this.assignedCustomerPointIds.forEach((id) => {
      newJunction.assignCustomerPoint(id);
    });

    return newJunction;
  }
}
