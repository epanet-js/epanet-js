import { Position } from "geojson";
import { BaseAsset, AssetId, AssetProperties, NO_ASSET_ID } from "./base-asset";
import measureLength from "@turf/length";
import { isSamePosition } from "@epanet-js/geometry";
import { Unit, convertTo } from "@epanet-js/quantity";

export type LinkConnections = [start: AssetId, end: AssetId];

export const nullCoordinates = [
  [0, 0],
  [0, 0],
];

export const nullConnections: LinkConnections = [NO_ASSET_ID, NO_ASSET_ID];

import { LinkType } from "./types";
export type { LinkType };

export const DEFAULT_MINOR_LOSS = 0;

export type LinkProperties = {
  type: LinkType;
  connections: LinkConnections;
  length: number | null;
} & AssetProperties;

export class Link<T> extends BaseAsset<T & LinkProperties> {
  constructor(
    id: AssetId,
    coordinates: Position[],
    properties: T & LinkProperties,
  ) {
    super(id, { type: "LineString", coordinates }, properties);
  }

  get isLink() {
    return true;
  }
  get isNode() {
    return false;
  }

  get type(): LinkType {
    return this.feature.properties.type;
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

  get segments(): [Position, Position][] {
    const result: [Position, Position][] = [];
    for (let i = 0; i < this.coordinates.length - 1; i++) {
      const start = this.coordinates[i];
      const end = this.coordinates[i + 1];
      result.push([start, end]);
    }
    return result;
  }

  addVertex(vertex: Position) {
    this.setCoordinates([...this.coordinates, vertex]);
  }

  setCoordinates(newCoordinates: Position[]) {
    if (newCoordinates.length < 2) {
      throw new Error(
        `Invalid number of points for link (${newCoordinates.length})`,
      );
    }

    this.geometry.coordinates = newCoordinates;
  }
}

export const computeLinkLength = (
  link: Link<unknown>,
  lengthUnit: Unit,
): number | null => {
  if (link.type !== "pipe") return null;
  return measureLinkLength(link, lengthUnit);
};

export const measureLinkLength = (
  link: Link<unknown>,
  lengthUnit: Unit,
): number => {
  const lengthInMeters =
    measureLength(link.feature, { units: "kilometers" }) * 1000;
  return parseFloat(
    convertTo({ value: lengthInMeters, unit: "m" }, lengthUnit).toFixed(2),
  );
};

export type LinkMidpoint = {
  position: Position;
  segment: [Position, Position];
};

const DEGREES_TO_RADIANS = Math.PI / 180;

const flatSegmentLength = ([[startX, startY], [endX, endY]]: [
  Position,
  Position,
]): number => {
  const dx =
    (endX - startX) * Math.cos(((startY + endY) / 2) * DEGREES_TO_RADIANS);
  const dy = endY - startY;
  return Math.sqrt(dx * dx + dy * dy);
};

export const findLinkMidpoint = <T>(link: Link<T>): LinkMidpoint => {
  const segments = link.segments;
  const lengths = segments.map(flatSegmentLength);
  const halfway = lengths.reduce((total, length) => total + length, 0) / 2;

  let walked = 0;
  for (let i = 0; i < segments.length; i++) {
    const length = lengths[i];
    if (length > 0 && walked + length >= halfway) {
      const [[startX, startY], [endX, endY]] = segments[i];
      const along = (halfway - walked) / length;
      return {
        position: [
          startX + (endX - startX) * along,
          startY + (endY - startY) * along,
        ],
        segment: segments[i],
      };
    }
    walked += length;
  }

  const [[x, y]] = segments[0];
  return { position: [x, y], segment: segments[0] };
};
