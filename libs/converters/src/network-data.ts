import type { Position } from "geojson";
import type { FlowUnit, LengthUnit, PressureUnit } from "@epanet-js/quantity";

export type SourceUnits = {
  flow?: FlowUnit;
  pressure?: PressureUnit;
  elevation?: LengthUnit;
  level?: LengthUnit;
  diameter?: LengthUnit;
};

export type SourceCrs = { type: "epsg"; code: number } | { type: "unknown" };

export type NodeData = {
  ref: string;
  label?: string;
  coordinates: Position;
  elevation?: number;
};

export type JunctionData = NodeData;

export type ReservoirData = NodeData & {
  head?: number;
};

export type TankData = NodeData & {
  initialLevel?: number;
  minLevel?: number;
  maxLevel?: number;
  diameter?: number;
  minVolume?: number;
};

export type NetworkData = {
  junctions: JunctionData[];
  reservoirs: ReservoirData[];
  tanks: TankData[];
  units: SourceUnits;
  crs: SourceCrs;
};

export const emptyNetworkData = (): NetworkData => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  units: {},
  crs: { type: "unknown" },
});
