import { Link, LinkProperties } from "./link";
import { QuantityProperty, StatusProperty } from "./base-asset";
import { QuantitiesSpec } from "src/quantity";

const statuses = ["open", "closed"] as const;
export type PipeStatus = (typeof statuses)[number];

export type PipeProperties = {
  type: "pipe";
  diameter: number;
  roughness: number;
  minorLoss: number;
  status: PipeStatus;
} & LinkProperties;

export type PipeQuantities = Pick<
  PipeProperties,
  "diameter" | "roughness" | "length" | "minorLoss"
>;

export type PipeExplain = Record<
  keyof PipeQuantities & "status",
  QuantityProperty | StatusProperty<PipeStatus>
>;

export type HeadlossFormula = "H-W" | "D-W" | "C-M";

const canonicalSpec: QuantitiesSpec<PipeQuantities> = {
  diameter: { defaultValue: 300, unit: "mm" },
  length: { defaultValue: 1000, unit: "m", decimals: 2 },
  roughness: { defaultValue: 130, unit: null }, //H-W
  minorLoss: { defaultValue: 0, unit: null },
};
export { canonicalSpec as pipeCanonicalSpec };

interface PipeSimulationProvider {
  getFlow: (id: string) => number;
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

  copy() {
    return new Pipe(this.id, [...this.coordinates], {
      ...this.properties,
    });
  }

  explainDeprecated(): PipeExplain {
    return {
      status: {
        type: "status",
        value: this.properties.status,
        options: statuses,
      },
      diameter: {
        type: "quantity",
        value: this.properties.diameter,
        unit: canonicalSpec.diameter.unit,
      },
      length: {
        type: "quantity",
        value: this.properties.length,
        unit: canonicalSpec.length.unit,
      },
      roughness: {
        type: "quantity",
        value: this.properties.roughness,
        unit: null,
      },
      minorLoss: {
        type: "quantity",
        value: this.properties.minorLoss,
        unit: null,
      },
    };
  }
}
