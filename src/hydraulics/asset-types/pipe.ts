import { Position } from "geojson";
import { Link, LinkAttributes } from "./link";
import { AssetId } from "./base-asset";
import { newFeatureId } from "src/lib/id";
import { Spec, canonicalize, getUnits, getValues } from "src/quantity";

export type PipeAttributes = {
  type: "pipe";
  diameter: number;
  roughnessHW: number;
  roughnessDW: number;
  roughnessCM: number;
} & LinkAttributes;

type PipeQuantities = Omit<
  PipeAttributes,
  "id" | "coordinates" | "type" | "connections" | "roughnessHW" | "roughnessCM"
>;

type HeadlossFormula = "H-W" | "D-W" | "C-M";
type RoughnessKeys = "roughnessHW" | "roughnessDW" | "roughnessCM";
const roughnessKeyFor: { [key in HeadlossFormula]: RoughnessKeys } = {
  "H-W": "roughnessHW",
  "D-W": "roughnessDW",
  "C-M": "roughnessCM",
};

const canonicalSpec: Spec<PipeQuantities> = {
  diameter: { value: 300, unit: "mm" },
  length: { value: 1000, unit: "m" },
  roughnessDW: { value: 0.26, unit: "mm" },
};
const defaultValues = getValues(canonicalSpec);
export const canonicalUnits = getUnits(canonicalSpec);

export const usCustomaryDefaultValues = canonicalize(
  {
    diameter: { value: 12, unit: "in" },
    length: { value: 1000, unit: "ft" },
    roughnessDW: { value: 0.00085, unit: "ft" },
  },
  canonicalSpec,
);

const nullCoordinates = [
  [0, 0],
  [0, 0],
];

type BuildData = {
  id?: AssetId;
  coordinates?: Position[];
} & Partial<PipeAttributes>;

export class Pipe extends Link<PipeAttributes> {
  static build({
    id = newFeatureId(),
    coordinates = nullCoordinates,
    connections = ["", ""],
    diameter,
    length,
    roughnessHW = 130,
    roughnessDW,
    roughnessCM = 0.012,
  }: BuildData = {}) {
    const attributes: PipeAttributes = {
      type: "pipe",
      diameter: diameter ?? defaultValues.diameter,
      length: length ?? defaultValues.length,
      roughnessHW: roughnessHW ?? defaultValues.roughnessHW,
      roughnessDW: roughnessDW ?? defaultValues.roughnessDW,
      roughnessCM: roughnessCM ?? defaultValues.roughnessCM,
      connections: connections,
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
}
