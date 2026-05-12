import { AssetId } from "src/hydraulic-model";

export type ProfilePoint = {
  nodeId: AssetId;
  nodeType: "junction" | "tank" | "reservoir";
  cumulativeLength: number;
  elevation: number;
  head: number | null;
  pressure: number | null;
  label: string;
  coordinates: [number, number];
};

export type ProfileLink = {
  linkId: AssetId;
  type: "pipe" | "pump" | "valve";
  valveKind?: string;
  status: string;
  isActive: boolean;
  startLength: number;
  endLength: number;
  midLength: number;
  label: string;
  reversed: boolean;
};

export type TerrainSample = {
  cumulativeLength: number;
  coordinates: [number, number];
};

export type TerrainPoint = {
  cumulativeLength: number;
  elevation: number;
};

export type HglRange = {
  nodeId: AssetId;
  minHead: number;
  maxHead: number;
};

export type HglBandSegment = { x: number; min: number; max: number };
