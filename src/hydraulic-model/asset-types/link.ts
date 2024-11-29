import { Position } from "geojson";
import { BaseAsset, AssetId, AssetProperties } from "./base-asset";
import measureLength from "@turf/length";
import { isSamePosition } from "src/lib/geometry";

export type LinkConnections = [start: string, end: string];

export const nullCoordinates = [
  [0, 0],
  [0, 0],
];

export const nullConnections: LinkConnections = ["", ""];

export type LinkProperties = {
  type: "pipe";
  connections: LinkConnections;
  length: number;
} & AssetProperties;

export class Link<T> extends BaseAsset<T & LinkProperties> {
  constructor(
    id: AssetId,
    coordinates: Position[],
    attributes: T & LinkProperties,
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
    return this.properties.connections;
  }

  setConnections(startNodeId: AssetId, endNodeId: AssetId) {
    this.properties.connections = [startNodeId, endNodeId];
  }

  get coordinates() {
    return this.geometry.coordinates as Position[];
  }

  get length() {
    return this.properties.length;
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

  get intermediateVertices(): Position[] {
    if (this.coordinates.length < 3) return [];

    return this.coordinates.slice(1, this.coordinates.length - 1);
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

    this.properties.length = length;
  }
}
