import { Position } from "geojson";
import { Asset, AssetId } from "./asset";
import measureLength from "@turf/length";

type LinkConnections = [start: string, end: string];

export interface LinkAsset {
  id: string;
  get connections(): LinkConnections;
  get coordinates(): Position[];
  get length(): number;
  setCoordinates: (newCoordinates: Position[]) => void;
  get isNode(): boolean;
  get isLink(): boolean;
}

export type LinkAttributes = {
  connections: LinkConnections;
  length: number;
};

export class Link<T> extends Asset<T & LinkAttributes> implements LinkAsset {
  constructor(
    id: AssetId,
    coordinates: Position[],
    attributes: T & LinkAttributes,
  ) {
    super(id, { type: "LineString", coordinates }, attributes);
  }

  get isLink() {
    return true;
  }
  get isNode() {
    return false;
  }

  get connections() {
    return this.attributes.connections;
  }

  get coordinates() {
    return this.geometry.coordinates as Position[];
  }

  get length() {
    return this.attributes.length;
  }

  setCoordinates(newCoordinates: Position[]) {
    this.geometry.coordinates = newCoordinates;

    const lengthInMeters =
      measureLength(this.feature, { units: "kilometers" }) * 1000;
    const length = parseFloat(lengthInMeters.toFixed(2));

    this.attributes.length = length;
  }
}
