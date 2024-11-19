import { Position } from "geojson";
import { Asset, AssetId } from "./asset";

export interface NodeAsset {
  get coordinates(): Position;
  setCoordinates: (newCoordinates: Position) => void;
  get elevation(): number;
  setElevation: (elevation: number) => void;
}

export type NodeAttributes = {
  elevation: number;
};

export class Node<T> extends Asset<T & NodeAttributes> implements NodeAsset {
  constructor(
    id: AssetId,
    coordinates: Position,
    attributes: T & NodeAttributes,
  ) {
    super(id, { type: "Point", coordinates }, attributes);
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
