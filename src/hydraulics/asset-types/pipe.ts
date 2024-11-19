import { Position } from "geojson";
import { Link, LinkAttributes } from "./link";
import { AssetId } from "./asset";
import { newFeatureId } from "src/lib/id";

export type PipeAttributes = {
  type: "pipe";
  diameter: number;
} & LinkAttributes;

export class Pipe extends Link<PipeAttributes> {
  static build({
    id = newFeatureId(),
    coordinates = [
      [0, 0],
      [0, 0],
    ],
    diameter = 0,
    length = 0,
    connections = ["", ""],
  }: {
    id?: AssetId;
    coordinates?: Position[];
  } & Partial<PipeAttributes> = {}) {
    return new Pipe(id, coordinates, {
      type: "pipe",
      diameter,
      length,
      connections,
    });
  }

  get diameter() {
    return this.attributes.diameter;
  }

  setDiameter(value: number) {
    this.attributes.diameter = value;
  }

  copy() {
    return new Pipe(this.id, [...this.coordinates], {
      ...this.attributes,
    });
  }
}
