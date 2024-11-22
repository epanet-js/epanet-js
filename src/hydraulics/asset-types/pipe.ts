import { Link, LinkAttributes } from "./link";
import { AssetQuantitiesSpec } from "./asset-quantities";
import { QuantityAttribute, StatusAttribute } from "./base-asset";

const statuses = ["open", "closed"] as const;
export type PipeStatus = (typeof statuses)[number];

export type PipeAttributes = {
  type: "pipe";
  diameter: number;
  roughnessHW: number;
  roughnessDW: number;
  roughnessCM: number;
  status: PipeStatus;
} & LinkAttributes;

export type PipeQuantities = Pick<
  PipeAttributes,
  "diameter" | "roughnessDW" | "roughnessHW" | "roughnessCM" | "length"
>;

export type PipeExplain = Record<
  keyof PipeQuantities & "status",
  QuantityAttribute | StatusAttribute<PipeStatus>
>;

export type HeadlossFormula = "H-W" | "D-W" | "C-M";
export type RoughnessKeys = "roughnessHW" | "roughnessDW" | "roughnessCM";
export const roughnessKeyFor: { [key in HeadlossFormula]: RoughnessKeys } = {
  "H-W": "roughnessHW",
  "D-W": "roughnessDW",
  "C-M": "roughnessCM",
};

const canonicalSpec: AssetQuantitiesSpec<PipeQuantities> = {
  diameter: { defaultValue: 300, unit: "mm" },
  length: { defaultValue: 1000, unit: "m" },
  roughnessDW: { defaultValue: 0.26, unit: "mm" },
  roughnessHW: { defaultValue: 130, unit: null },
  roughnessCM: { defaultValue: 0.012, unit: null },
};
export { canonicalSpec as pipeCanonicalSpec };

export class Pipe extends Link<PipeAttributes> {
  get diameter() {
    return this.attributes.diameter;
  }

  setDiameter(value: number) {
    this.attributes.diameter = value;
  }

  roughnessFor(headlossFormula: HeadlossFormula) {
    return this.attributes[roughnessKeyFor[headlossFormula]];
  }

  setRoughness(value: number, headlossFormula: HeadlossFormula) {
    this.attributes[roughnessKeyFor[headlossFormula]] = value;
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
      roughnessCM: {
        type: "quantity",
        value: this.attributes.roughnessCM,
        unit: null,
      },
      roughnessDW: {
        type: "quantity",
        value: this.attributes.roughnessDW,
        unit: canonicalSpec.roughnessDW.unit,
      },
      roughnessHW: {
        type: "quantity",
        value: this.attributes.roughnessHW,
        unit: null,
      },
    };
  }
}
