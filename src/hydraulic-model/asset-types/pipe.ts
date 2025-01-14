import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const pipeStatuses = ["open", "closed"] as const;
export type PipeStatus = (typeof pipeStatuses)[number];

export type PipeProperties = {
  type: "pipe";
  diameter: number;
  roughness: number;
  minorLoss: number;
  status: PipeStatus;
} & LinkProperties;

export const pipeQuantities = [
  "diameter",
  "roughness",
  "length",
  "minorLoss",
  "flow",
  "velocity",
];
export type PipeQuantity = (typeof pipeQuantities)[number];

export type HeadlossFormula = "H-W" | "D-W" | "C-M";

interface PipeSimulationProvider {
  getFlow: (id: string) => number | null;
  getVelocity: (id: string) => number | null;
}

export class Pipe extends Link<PipeProperties> {
  private simulation: PipeSimulationProvider | null = null;

  get diameter() {
    return this.properties.diameter;
  }

  setDiameter(value: number) {
    this.properties.diameter = value;
  }

  get roughness() {
    return this.properties.roughness;
  }

  setRoughness(value: number) {
    this.properties.roughness = value;
  }

  get status() {
    return this.properties.status;
  }

  setStatus(newStatus: PipeStatus) {
    this.properties.status = newStatus;
  }

  get minorLoss() {
    return this.properties.minorLoss;
  }

  get flow() {
    if (!this.simulation) return null;

    return this.simulation.getFlow(this.id);
  }

  get velocity() {
    if (!this.simulation) return null;

    return this.simulation.getVelocity(this.id);
  }

  setSimulation(simulation: PipeSimulationProvider) {
    this.simulation = simulation;
  }

  getUnit(quantity: PipeQuantity): Unit {
    return this.units[quantity];
  }

  copy() {
    return new Pipe(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );
  }
}
