import { Position } from "geojson";
import { AssetId } from "./asset";
import { Node, NodeAttributes } from "./node";
import { newFeatureId } from "src/lib/id";

export type JunctionAttributes = {
  type: "junction";
} & NodeAttributes;

export class Junction extends Node<JunctionAttributes> {
  static build({
    id = newFeatureId(),
    coordinates = [0, 0],
    elevation = 0,
  }: {
    coordinates?: Position;
    id?: AssetId;
  } & Partial<JunctionAttributes> = {}) {
    return new Junction(id, coordinates, {
      type: "junction",
      elevation,
    });
  }

  copy() {
    return new Junction(this.id, [...this.coordinates], { ...this.attributes });
  }
}
