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

type ValveSimulationProvider = {
  getFlow: (id: string) => number | null;
  getVelocity: (id: string) => number | null;
  getHeadloss: (id: string) => number | null;
  getValveStatus: (id: string) => ValveStatus | null;
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

  get flow() {
    if (!this.simulation) return null;

    return this.simulation.getFlow(this.id);
  }

  get velocity() {
    if (!this.simulation) return null;

    return this.simulation.getVelocity(this.id);
  }

  get headloss() {
    if (!this.simulation) return null;

    return this.simulation.getHeadloss(this.id);
  }

  get status() {
    if (!this.simulation) return null;

    return this.simulation.getValveStatus(this.id);
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
