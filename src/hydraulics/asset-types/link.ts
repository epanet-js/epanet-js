import { Position } from "geojson";
import { Asset, AssetId } from "./asset";
import measureLength from "@turf/length";
import { isSamePosition } from "src/lib/geometry";
import { LinkType } from ".";

type LinkConnections = [start: string, end: string];

export interface LinkAsset {
  id: string;
  get connections(): LinkConnections;
  get coordinates(): Position[];
  get length(): number;
  setCoordinates: (newCoordinates: Position[]) => void;
  get isNode(): boolean;
  get isLink(): boolean;
  isStart(position: Position): boolean;
  isEnd(position: Position): boolean;
  copy: () => LinkType;
  get firstVertex(): Position;
  get lastVertex(): Position;
}

export type LinkAttributes = {
  type: "pipe";
  connections: LinkConnections;
  length: number;
};

export abstract class Link<T>
  extends Asset<T & LinkAttributes>
  implements LinkAsset
{
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

  setConnections(startNodeId: AssetId, endNodeId: AssetId) {
    this.attributes.connections = [startNodeId, endNodeId];
  }

  get coordinates() {
    return this.geometry.coordinates as Position[];
  }

  get length() {
    return this.attributes.length;
  }

  isStart(position: Position) {
    return isSamePosition(this.firstVertex, position);
  }

  isEnd(position: Position) {
    return isSamePosition(this.lastVertex, position);
  }

  get firstVertex(): Position {
    const vertex = this.coordinates[0];
    if (!vertex) throw new Error("Link has no vertex!");

    return vertex;
  }

  get lastVertex(): Position {
    const vertex = this.coordinates.at(-1);
    if (!vertex) throw new Error("Link has no vertex!");

    return vertex;
  }

  addVertex(vertex: Position) {
    this.setCoordinates([...this.coordinates, vertex]);
  }

  extendTo(position: Position) {
    this.setCoordinates([...this.coordinates.slice(0, -1), position]);
  }

  setCoordinates(newCoordinates: Position[]) {
    this.geometry.coordinates = newCoordinates;

    const lengthInMeters =
      measureLength(this.feature, { units: "kilometers" }) * 1000;
    const length = parseFloat(lengthInMeters.toFixed(2));

    this.attributes.length = length;
  }

  abstract copy(): LinkType;
}
