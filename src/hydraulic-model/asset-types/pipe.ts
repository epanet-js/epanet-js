import { Link, LinkProperties } from "./link";
import { QuantitiesSpec, Unit } from "src/quantity";

const statuses = ["open", "closed"] as const;
export type PipeStatus = (typeof statuses)[number];

export type PipeProperties = {
  type: "pipe";
  diameter: number;
  roughness: number;
  minorLoss: number;
  status: PipeStatus;
} & LinkProperties;

export type PipeQuantity =
  | "diameter"
  | "roughness"
  | "length"
  | "minorLoss"
  | "flow";

export type PipeQuantities = Pick<
  PipeProperties,
  "diameter" | "roughness" | "length" | "minorLoss"
> & { flow: number };

export type HeadlossFormula = "H-W" | "D-W" | "C-M";

const canonicalSpec: QuantitiesSpec<PipeQuantities> = {
  diameter: { defaultValue: 300, unit: "mm" },
  length: { defaultValue: 1000, unit: "m", decimals: 2 },
  roughness: { defaultValue: 130, unit: null }, //H-W
  minorLoss: { defaultValue: 0, unit: null },
  flow: { defaultValue: 0, unit: "l/s" },
};

export { canonicalSpec as pipeCanonicalSpec };

interface PipeSimulationProvider {
  getFlow: (id: string) => number | null;
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

  get minorLoss() {
    return this.properties.minorLoss;
  }

  get flow() {
    if (!this.simulation) return null;

    return this.simulation.getFlow(this.id);
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
