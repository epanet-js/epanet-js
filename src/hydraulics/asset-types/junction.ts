import { Position } from "geojson";
import { AssetId } from "./asset";
import { Node, NodeAttributes } from "./node";

export type JunctionAttributes = {
  type: "junction";
} & NodeAttributes;

export class Junction extends Node<JunctionAttributes> {
  static build(
    id: AssetId,
    coordinates: Position,
    attributes: Partial<JunctionAttributes> = {},
  ) {
    const defaultAttributes: JunctionAttributes = {
      type: "junction",
      elevation: 0,
    };
    return new Junction(id, coordinates, {
      ...defaultAttributes,
      ...attributes,
    });
  }

  copy() {
    return new Junction(
      this.id,
      { ...this.coordinates },
      { ...this.attributes },
    );
  }
}
