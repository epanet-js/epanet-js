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
} & LinkProperties;

export const pumpQuantities = [
  "flow",
  "head",
  "designFlow",
  "designHead",
  "power",
];
export type PumpQuantity = (typeof pumpQuantities)[number];

interface PumpSimulationProvider {
  getFlow: (id: string) => number | null;
  getHeadloss: (id: string) => number | null;
  getPumpStatus: (id: string) => PumpStatus | null;
  getPumpStatusWarning: (id: string) => PumpStatusWarning | null;
}

export class Pump extends Link<PumpProperties> {
  private simulation: PumpSimulationProvider | null = null;

  getUnit(quantity: PumpQuantity): Unit {
    return this.units[quantity];
  }

  setSimulation(simulation: PumpSimulationProvider) {
    this.simulation = simulation;
  }

  get initialStatus() {
    return this.properties.initialStatus;
  }

  get status() {
    if (!this.simulation) return null;

    return this.simulation.getPumpStatus(this.id);
  }

  get statusWarning() {
    if (!this.simulation) return null;

    return this.simulation.getPumpStatusWarning(this.id);
  }

  get flow() {
    if (!this.simulation) return null;

    return this.simulation.getFlow(this.id);
  }

  get head() {
    if (!this.simulation) return null;

    const headloss = this.simulation.getHeadloss(this.id);
    if (headloss === null) return null;
    return -headloss;
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

  copy() {
    return new Pump(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );
  }
}
