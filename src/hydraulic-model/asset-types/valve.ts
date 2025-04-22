import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const valveStatuses = ["active", "open", "closed"] as const;
export type ValveStatus = (typeof valveStatuses)[number];

export type ValveType = "tcv";

export type ValveProperties = {
  type: "valve";
  diameter: number;
  minorLoss: number;
  valveType: ValveType;
  setting: number;
  initialStatus: ValveStatus;
} & LinkProperties;

export const valveQuantities = ["diameter", "minorLoss", "setting"];
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

  get diameter() {
    return this.properties.diameter;
  }

  get minorLoss() {
    return this.properties.minorLoss;
  }

  get valveType() {
    return this.properties.valveType;
  }

  get setting() {
    return this.properties.setting;
  }

  get initialStatus() {
    return this.properties.initialStatus;
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
