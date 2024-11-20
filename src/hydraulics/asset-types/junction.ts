import { Position } from "geojson";
import { AssetId } from "./base-asset";
import { Node, NodeAttributes } from "./node";
import { newFeatureId } from "src/lib/id";
import { Spec, getUnits, getValues } from "src/quantity";

export type JunctionAttributes = {
  type: "junction";
  demand: number;
} & NodeAttributes;

type JunctionQuantities = Omit<JunctionAttributes, "type">;

const canonicalSpec: Spec<JunctionQuantities> = {
  elevation: { value: 0, unit: "m" },
  demand: { value: 0, unit: "l/s" },
};
const defaultValues = getValues(canonicalSpec);
export const canonicalUnits = getUnits(canonicalSpec);

export class Junction extends Node<JunctionAttributes> {
  static build({
    id = newFeatureId(),
    coordinates = [0, 0],
    elevation,
    demand,
  }: {
    coordinates?: Position;
    id?: AssetId;
  } & Partial<JunctionAttributes> = {}) {
    return new Junction(id, coordinates, {
      type: "junction",
      elevation: elevation ?? defaultValues.elevation,
      demand: demand ?? defaultValues.demand,
    });
  }

  get demand() {
    return this.attributes.demand;
  }

  copy() {
    return new Junction(this.id, [...this.coordinates], { ...this.attributes });
  }
}
