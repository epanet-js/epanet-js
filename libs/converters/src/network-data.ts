import type { Position } from "geojson";
import type {
  HeadlossFormula,
  PipeStatus,
  PumpStatus,
  ValveKind,
  ValveStatus,
} from "@epanet-js/hydraulic-model";
import type {
  FlowUnit,
  LengthUnit,
  PressureUnit,
  VolumeUnit,
} from "@epanet-js/quantity";

export type SourceUnits = {
  flow?: FlowUnit;
  pressure?: PressureUnit;
  elevation?: LengthUnit;
  level?: LengthUnit;
  diameter?: LengthUnit;
  tankDiameter?: LengthUnit;
  length?: LengthUnit;
  volume?: VolumeUnit;
};

export type SourceCrs = { type: "epsg"; code: number } | { type: "unknown" };

export type NodeData = {
  ref: string;
  label?: string;
  coordinates: Position;
  elevation?: number;
};

export type DemandData = {
  baseDemand: number;
  patternRef?: string;
};

export type JunctionData = NodeData & {
  demands?: DemandData[];
};

export type ReservoirData = NodeData & {
  head?: number;
  headPatternRef?: string;
};

export type TankData = NodeData & {
  initialLevel?: number;
  minLevel?: number;
  maxLevel?: number;
  diameter?: number;
  minVolume?: number;
  volumeCurveRef?: string;
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
  minorLoss?: number;
  material?: string;
  initialStatus?: PipeStatus;
};

export type SourceValveKind = ValveKind | "unknown";

export type ValveData = LinkData & {
  kind: SourceValveKind;
  diameter?: number;
  setting?: number;
  initialStatus?: ValveStatus;
};

export type PumpData = LinkData & {
  speed?: number;
  speedPatternRef?: string;
  initialStatus?: PumpStatus;
  curveRef?: string;
};

export type CurvePointData = { x: number; y: number };

export type CurveData = {
  ref: string;
  label?: string;
  points: CurvePointData[];
};

export type PatternData = {
  ref: string;
  label?: string;
  multipliers: number[];
};

export type TankLevelControlData = {
  type: "tankLevel";
  linkRef: string;
  tankRef: string;
  on: { level: number; setting: number };
  off: { level: number };
};

export type ControlData = TankLevelControlData;

export type NetworkData = {
  junctions: JunctionData[];
  reservoirs: ReservoirData[];
  tanks: TankData[];
  pipes: PipeData[];
  pumps: PumpData[];
  valves: ValveData[];
  curves: CurveData[];
  patterns: PatternData[];
  controls: ControlData[];
  patternTimeStep?: number;
  headlossFormula?: HeadlossFormula;
  units: SourceUnits;
  crs: SourceCrs;
};

export const emptyNetworkData = (): NetworkData => ({
  junctions: [],
  reservoirs: [],
  tanks: [],
  pipes: [],
  pumps: [],
  valves: [],
  curves: [],
  patterns: [],
  controls: [],
  units: {},
  crs: { type: "unknown" },
});
