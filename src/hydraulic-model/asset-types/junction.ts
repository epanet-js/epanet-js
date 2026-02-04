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

export class Junction extends Node<JunctionProperties> {
  get demands(): JunctionDemand[] {
    return this.properties.demands;
  }

  getDirectDemand(patterns: DemandPatterns): number {
    return calculateAverageDemand(this.demands, patterns);
  }

  setDemands(demands: JunctionDemand[]) {
    this.properties.demands = demands;
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
