import { Position } from "geojson";
import { BaseAsset, AssetId } from "./base-asset";

export type NodeAttributes = {
  type: "junction";
  elevation: number;
};

export class Node<T> extends BaseAsset<T & NodeAttributes> {
  constructor(
    id: AssetId,
    coordinates: Position,
    attributes: T & NodeAttributes,
  ) {
    super(id, { type: "Point", coordinates }, attributes);
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
    return this.attributes.elevation;
  }

  setCoordinates(newCoordinates: Position) {
    this.geometry.coordinates = newCoordinates;
  }

  setElevation(elevation: number) {
    this.attributes.elevation = elevation;
  }
}
