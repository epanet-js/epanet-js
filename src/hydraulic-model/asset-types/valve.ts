import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export type ValveProperties = {
  type: "valve";
} & LinkProperties;

export const valveQuantities = [];
export type ValveQuantity = (typeof valveQuantities)[number];

type ValveSimulationProvider = {
  getFlow: (id: string) => number | null;
};

export class Valve extends Link<ValveProperties> {
  private simulation: ValveSimulationProvider | null = null;

  getUnit(quantity: ValveQuantity): Unit {
    return this.units[quantity];
  }

  setSimulation(simulation: ValveSimulationProvider) {
    this.simulation = simulation;
  }

  copy() {
    return new Valve(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );
  }
}
