import { Link, LinkProperties } from "./link";
import { Unit } from "src/quantity";

export const pipeStatuses = ["open", "closed", "cv"] as const;
export type PipeStatus = (typeof pipeStatuses)[number];

export type PipeProperties = {
  type: "pipe";
  diameter: number;
  roughness: number;
  minorLoss: number;
  initialStatus: PipeStatus;
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

export class Pipe extends Link<PipeProperties> {
  private attachedCustomerPointIdsSet: Set<string> = new Set();

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

  get initialStatus() {
    return this.properties.initialStatus;
  }

  setInitialStatus(newStatus: PipeStatus) {
    this.properties.initialStatus = newStatus;
  }

  get minorLoss() {
    return this.properties.minorLoss;
  }

  getUnit(quantity: PipeQuantity): Unit {
    return this.units[quantity];
  }

  copy() {
    const newPipe = new Pipe(
      this.id,
      [...this.coordinates],
      {
        ...this.properties,
      },
      this.units,
    );

    return newPipe;
  }
}
