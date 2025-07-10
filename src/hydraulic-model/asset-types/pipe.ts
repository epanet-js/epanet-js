import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const pipeStatuses = ["open", "closed", "CV"] as const;
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

export const headlossFormulas = ["H-W", "D-W", "C-M"] as const;
export const headlossFormulasFullNames = [
  "Hazen-Williams",
  "Darcy-Weisbach",
  "Chezy-Manning",
] as const;
export type HeadlossFormula = (typeof headlossFormulas)[number];

export type PipeSimulation = {
  flow: number;
  velocity: number;
  headloss: number;
  unitHeadloss: number;
  status: "open" | "closed";
};

export class Pipe extends Link<PipeProperties> {
  private simulation: PipeSimulation | null = null;

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

  get unitHeadloss() {
    if (!this.simulation) return null;

    return this.simulation.unitHeadloss;
  }

  get simulationStatus() {
    if (!this.simulation) return null;

    return this.simulation.status;
  }

  setSimulation(simulation: PipeSimulation | null) {
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
