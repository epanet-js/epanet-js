import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const pumpStatuses = ["on", "off"] as const;
export type PumpStatus = (typeof pumpStatuses)[number];

export type PumpProperties = {
  type: "pump";
  status: PumpStatus;
} & LinkProperties;

export const pumpQuantities = [];
export type PumpQuantity = (typeof pumpQuantities)[number];

interface PumpSimulationProvider {}

export class Pump extends Link<PumpProperties> {
  private simulation: PumpSimulationProvider | null = null;

  getUnit(quantity: PumpQuantity): Unit {
    return this.units[quantity];
  }

  setSimulation(simulation: PumpSimulationProvider) {
    this.simulation = simulation;
  }

  get status() {
    return this.properties.status;
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
