import { Link, LinkProperties } from "./link";
import { QuantityProperty, StatusProperty } from "./base-asset";
import { QuantitiesSpec } from "src/quantity";

const statuses = ["open", "closed"] as const;
export type PipeStatus = (typeof statuses)[number];

export type PipeProperties = {
  type: "pipe";
  diameter: number;
  roughness: number;
  status: PipeStatus;
} & LinkProperties;

export type PipeQuantities = Pick<
  PipeProperties,
  "diameter" | "roughness" | "length"
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
};
export { canonicalSpec as pipeCanonicalSpec };

export class Pipe extends Link<PipeProperties> {
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

  copy() {
    return new Pipe(this.id, [...this.coordinates], {
      ...this.properties,
    });
  }

  explain(): PipeExplain {
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
    };
  }
}
