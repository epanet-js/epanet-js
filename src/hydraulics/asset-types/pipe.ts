import { Position } from "geojson";
import { Link, LinkAttributes } from "./link";
import { AssetId } from "./asset";

export type PipeAttributes = {
  type: "pipe";
  diameter: number;
} & LinkAttributes;

export class Pipe extends Link<PipeAttributes> {
  static build(
    id: AssetId,
    coordinates: Position[],
    attributes: Partial<PipeAttributes> = {},
  ) {
    const defaultAttributes: PipeAttributes = {
      type: "pipe",
      length: 0,
      diameter: 0,
      connections: ["", ""],
    };
    return new Pipe(id, coordinates, { ...defaultAttributes, ...attributes });
  }

  get diameter() {
    return this.attributes.diameter;
  }

  setDiameter(value: number) {
    this.attributes.diameter = value;
  }

  copy() {
    return new Pipe(this.id, { ...this.coordinates }, { ...this.attributes });
  }
}
