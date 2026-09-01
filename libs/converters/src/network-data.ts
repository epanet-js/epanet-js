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

export type CustomAttributeType = "text" | "number";

export type CustomAttributeData = {
  ref: string;
  name: string;
  type: CustomAttributeType;
};

export type CustomAttributeValues = Record<string, string | number>;

export type NodeData = {
  ref: string;
  label?: string;
  coordinates: Position;
  elevation?: number;
  customAttributes?: CustomAttributeValues;
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
  overflow?: boolean;
};

export type LinkData = {
  ref: string;
  label?: string;
  startNodeRef: string;
  endNodeRef: string;
  vertices?: Position[];
  isActive?: boolean;
  customAttributes?: CustomAttributeValues;
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

export type ZoneData = {
  ref: string;
  label?: string;
  polygons: Position[][][];
};

export type ControlLinkKind = "pipe" | "pump" | "valve";
export type ControlNodeKind = "junction" | "reservoir" | "tank";

export type ControlLinkRef = { kind: ControlLinkKind; ref: string };
export type ControlNodeRef = { kind: ControlNodeKind; ref: string };

export type ControlAction = { setting: number } | { status: "open" | "closed" };

export type TankLevelControlData = {
  type: "tankLevel";
  link: ControlLinkRef;
  tankRef: string;
  on: { level: number } & ({ setting: number } | { status: "open" });
  off: { level: number };
};

export type TimedSettingStepData = { time: number } & ControlAction;

export type TimedSettingControlData = {
  type: "timedSetting";
  link: ControlLinkRef;
  steps: TimedSettingStepData[];
};

export type TankFloatControlData = {
  type: "tankFloat";
  link: ControlLinkRef;
  tankRef: string;
  reopenDrop: number;
};

export type RemotePressureControlData = {
  type: "remotePressure";
  link: ControlLinkRef;
  node: ControlNodeRef;
  pressure: number;
};

export type FlowModulatedSetpointControlData = {
  type: "flowModulatedSetpoint";
  link: ControlLinkRef;
  source: ControlLinkRef;
  curveRef: string;
};

export type ControlData =
  | TankLevelControlData
  | TimedSettingControlData
  | TankFloatControlData
  | RemotePressureControlData
  | FlowModulatedSetpointControlData;

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
  customAttributes: CustomAttributeData[];
  zones: ZoneData[];
  patternTimeStep?: number;
  simulationDuration?: number;
  viscosity?: number;
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
  customAttributes: [],
  zones: [],
  units: {},
  crs: { type: "unknown" },
});
