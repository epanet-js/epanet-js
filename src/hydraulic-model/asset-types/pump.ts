import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const pumpStatuses = ["on", "off"] as const;
export type PumpStatus = (typeof pumpStatuses)[number];

export type PumpStatusWarning = "cannot-deliver-flow" | "cannot-deliver-head";

export type PumpDefintionType = "power" | "flow-vs-head";

export type PumpProperties = {
  type: "pump";
  initialStatus: PumpStatus;
  definitionType: PumpDefintionType;
  designFlow: number;
  designHead: number;
  power: number;
  speed: number;
} & LinkProperties;

export const pumpQuantities = [
  "flow",
  "head",
  "designFlow",
  "designHead",
  "power",
  "speed",
];
export type PumpQuantity = (typeof pumpQuantities)[number];

export type PumpSimulation = {
  flow: number;
  headloss: number;
  status: PumpStatus;
  statusWarning: PumpStatusWarning | null;
};

export class Pump extends Link<PumpProperties> {
  private simulation: PumpSimulation | null = null;

  getUnit(quantity: PumpQuantity): Unit {
    return this.units[quantity];
  }

  setSimulation(simulation: PumpSimulation | null) {
    this.simulation = simulation;
  }

  get initialStatus() {
    return this.properties.initialStatus;
  }

  get definitionType() {
    return this.properties.definitionType;
  }

  get designHead() {
    return this.properties.designHead;
  }

  get designFlow() {
    return this.properties.designFlow;
  }

  get power() {
    return this.properties.power;
  }

  get speed() {
    return this.properties.speed;
  }

  get status() {
    if (!this.simulation) return null;

    return this.simulation.status;
  }

  get statusWarning() {
    if (!this.simulation) return null;

    return this.simulation.statusWarning;
  }

  get flow() {
    if (!this.simulation) return null;

    return this.simulation.flow;
  }

  get head() {
    if (!this.simulation) return null;

    const headloss = this.simulation.headloss;
    if (headloss === null) return null;
    return -headloss;
  }

  copy() {
    return new Pump(
      this.id,
      this.internalId,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );
  }
}
