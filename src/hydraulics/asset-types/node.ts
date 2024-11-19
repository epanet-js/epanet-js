import { Position } from "geojson";
import { Asset, AssetGeometry, AssetId, AssetAttributes } from "./asset";
import { IFeature } from "src/types";
import { NodeType } from ".";

export interface NodeAsset {
  id: string;
  get feature(): IFeature<AssetGeometry, AssetAttributes>;
  get coordinates(): Position;
  setCoordinates: (newCoordinates: Position) => void;
  get elevation(): number;
  setElevation: (elevation: number) => void;
  get isNode(): boolean;
  get isLink(): boolean;
  copy: () => NodeType;
}

export type NodeAttributes = {
  type: "junction";
  elevation: number;
};

export abstract class Node<T>
  extends Asset<T & NodeAttributes>
  implements NodeAsset
{
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

  abstract copy(): NodeType;
}
