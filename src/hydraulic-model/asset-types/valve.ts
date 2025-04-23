import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const valveStatuses = ["active", "open", "closed"] as const;
export type ValveStatus = (typeof valveStatuses)[number];

export const valveTypes = ["tcv", "prv", "psv", "pbv", "fcv"] as const;
export type ValveType = (typeof valveTypes)[number];

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

export type ValveSimulation = {
  flow: number;
  velocity: number;
  headloss: number;
  status: ValveStatus;
};

export class Valve extends Link<ValveProperties> {
  private simulation: ValveSimulation | null = null;

  getUnit(quantity: ValveQuantity): Unit {
    return this.units[quantity];
  }

  setSimulation(simulation: ValveSimulation | null) {
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

  get flow() {
    if (!this.simulation) return null;

    return this.simulation.flow;
  }

  get velocity() {
    if (!this.simulation) return null;

    return this.simulation.velocity;
  }

  get headloss() {
    if (!this.simulation) return null;

    return this.simulation.headloss;
  }

  get status() {
    if (!this.simulation) return null;

    return this.simulation.status;
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
