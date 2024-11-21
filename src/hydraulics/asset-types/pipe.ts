import { Position } from "geojson";
import {
  Link,
  LinkAttributes,
  LinkConnections,
  nullConnections,
  nullCoordinates,
} from "./link";
import { AssetId } from "./base-asset";
import { newFeatureId } from "src/lib/id";
import {
  Quantity,
  QuantityMap,
  QuantityOrNumberMap,
  createCanonicalMap,
} from "src/quantity";

export type PipeAttributes = {
  type: "pipe";
  diameter: number;
  roughnessHW: number;
  roughnessDW: number;
  roughnessCM: number;
} & LinkAttributes;

export type PipeQuantities = Pick<
  PipeAttributes,
  "diameter" | "roughnessDW" | "length"
>;

export type PipeExplain = Record<
  keyof Omit<PipeAttributes, "connections" | "type" | "visibility">,
  Quantity
>;
export type HeadlossFormula = "H-W" | "D-W" | "C-M";
export type RoughnessKeys = "roughnessHW" | "roughnessDW" | "roughnessCM";
export const roughnessKeyFor: { [key in HeadlossFormula]: RoughnessKeys } = {
  "H-W": "roughnessHW",
  "D-W": "roughnessDW",
  "C-M": "roughnessCM",
};

type BuildData = {
  id?: AssetId;
  coordinates?: Position[];
  connections?: LinkConnections;
  roughnessHW?: number;
  roughnessCM?: number;
} & Partial<QuantityOrNumberMap<PipeQuantities>>;

const canonicalSpec: QuantityMap<PipeQuantities> = {
  diameter: { value: 300, unit: "mm" },
  length: { value: 1000, unit: "m" },
  roughnessDW: { value: 0.26, unit: "mm" },
};
export { canonicalSpec as pipeQuantitiesSpec };
const toCanonical = createCanonicalMap(canonicalSpec);

export class Pipe extends Link<PipeAttributes> {
  static build({
    id = newFeatureId(),
    coordinates = nullCoordinates,
    connections = nullConnections,
    roughnessHW = 130,
    roughnessCM = 0.012,
    ...quantities
  }: BuildData = {}) {
    const attributes: PipeAttributes = {
      type: "pipe",
      connections,
      roughnessHW,
      roughnessCM,
      roughnessDW: toCanonical(quantities, "roughnessDW"),
      length: toCanonical(quantities, "length"),
      diameter: toCanonical(quantities, "diameter"),
    };

    return new Pipe(id, coordinates, attributes);
  }

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
      diameter: {
        value: this.attributes.diameter,
        unit: canonicalSpec.diameter.unit,
      },
      length: {
        value: this.attributes.length,
        unit: canonicalSpec.length.unit,
      },
      roughnessCM: {
        value: this.attributes.roughnessCM,
        unit: null,
      },
      roughnessDW: {
        value: this.attributes.roughnessDW,
        unit: canonicalSpec.roughnessDW.unit,
      },
      roughnessHW: {
        value: this.attributes.roughnessHW,
        unit: null,
      },
    };
  }
}
