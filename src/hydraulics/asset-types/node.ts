import { Position } from "geojson";
import { Asset, AssetGeometry, AssetId, VisibilityAttributes } from "./asset";
import { IFeature } from "src/types";

export interface NodeAsset {
  id: string;
  get feature(): IFeature<AssetGeometry, VisibilityAttributes>;
  get coordinates(): Position;
  setCoordinates: (newCoordinates: Position) => void;
  get elevation(): number;
  setElevation: (elevation: number) => void;
  get isNode(): boolean;
  get isLink(): boolean;
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
