import { Link, LinkAttributes } from "./link";
import { QuantityAttribute, StatusAttribute } from "./base-asset";
import { QuantitiesSpec } from "src/quantity";

const statuses = ["open", "closed"] as const;
export type PipeStatus = (typeof statuses)[number];

export type PipeAttributes = {
  type: "pipe";
  diameter: number;
  roughness: number;
  status: PipeStatus;
} & LinkAttributes;

export type PipeQuantities = Pick<
  PipeAttributes,
  "diameter" | "roughness" | "length"
>;

export type PipeExplain = Record<
  keyof PipeQuantities & "status",
  QuantityAttribute | StatusAttribute<PipeStatus>
>;

export type HeadlossFormula = "H-W" | "D-W" | "C-M";

const canonicalSpec: QuantitiesSpec<PipeQuantities> = {
  diameter: { defaultValue: 300, unit: "mm" },
  length: { defaultValue: 1000, unit: "m", decimals: 2 },
  roughness: { defaultValue: 130, unit: null }, //H-W
};
export { canonicalSpec as pipeCanonicalSpec };

export class Pipe extends Link<PipeAttributes> {
  get diameter() {
    return this.attributes.diameter;
  }

  setDiameter(value: number) {
    this.attributes.diameter = value;
  }

  get roughness() {
    return this.attributes.roughness;
  }

  setRoughness(value: number) {
    this.attributes.roughness = value;
  }

  copy() {
    return new Pipe(this.id, [...this.coordinates], {
      ...this.attributes,
    });
  }

  explain(): PipeExplain {
    return {
      status: {
        type: "status",
        value: this.attributes.status,
        options: statuses,
      },
      diameter: {
        type: "quantity",
        value: this.attributes.diameter,
        unit: canonicalSpec.diameter.unit,
      },
      length: {
        type: "quantity",
        value: this.attributes.length,
        unit: canonicalSpec.length.unit,
      },
      roughness: {
        type: "quantity",
        value: this.attributes.roughness,
        unit: null,
      },
    };
  }
}
