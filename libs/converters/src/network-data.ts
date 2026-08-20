import type { Position } from "geojson";
import type { HeadlossFormula } from "@epanet-js/hydraulic-model";
import type { FlowUnit, LengthUnit, PressureUnit } from "@epanet-js/quantity";

export type SourceUnits = {
  flow?: FlowUnit;
  pressure?: PressureUnit;
  elevation?: LengthUnit;
  level?: LengthUnit;
  diameter?: LengthUnit;
  length?: LengthUnit;
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

export type LinkData = {
  ref: string;
  label?: string;
  startNodeRef: string;
  endNodeRef: string;
  vertices?: Position[];
  isActive?: boolean;
};

export type PipeData = LinkData & {
  length?: number;
  diameter?: number;
  roughness?: number;
};

export type NetworkData = {
  junctions: JunctionData[];
  reservoirs: ReservoirData[];
  tanks: TankData[];
  pipes: PipeData[];
  headlossFormula?: HeadlossFormula;
  units: SourceUnits;
  crs: SourceCrs;
};

export const emptyNetworkData = (): NetworkData => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  pipes: [],
  units: {},
  crs: { type: "unknown" },
});
