import { Position } from "geojson";
import { BaseAsset, AssetId, AssetProperties, AssetUnits } from "./base-asset";
import { NodeType } from "./types";

export type NodeProperties = {
  elevation: number;
  type: NodeType;
} & AssetProperties;

export class Node<T> extends BaseAsset<T & NodeProperties> {
  constructor(
    id: AssetId,
    coordinates: Position,
    attributes: T & NodeProperties,
    units: AssetUnits,
  ) {
    super(id, { type: "Point", coordinates }, attributes, units);
  }

  get isLink() {
    return false;
  }

  get isNode() {
    return true;
  }

  get coordinates() {
    return this.geometry.coordinates as Position;
  }

  get elevation() {
    return this.properties.elevation;
  }

  setCoordinates(newCoordinates: Position) {
    this.geometry.coordinates = newCoordinates;
  }

  setElevation(elevation: number) {
    this.properties.elevation = elevation;
  }
}
