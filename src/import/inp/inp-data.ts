import { Position } from "geojson";
import { nullEPSTiming } from "src/hydraulic-model";
import {
  HeadlossFormula,
  PipeStatus,
} from "src/hydraulic-model/asset-types/pipe";
import { ValveKind } from "src/hydraulic-model/asset-types/valve";
import { EpanetUnitSystem } from "src/simulation/build-inp";

export type PipeData = {
  id: string;
  startNodeDirtyId: string;
  endNodeDirtyId: string;
  length: number;
  diameter: number;
  roughness: number;
  minorLoss: number;
  initialStatus: PipeStatus;
  isActive: boolean;
};

export type PumpData = {
  id: string;
  startNodeDirtyId: string;
  endNodeDirtyId: string;
  power?: number;
  curveId?: string;
  speed?: number;
  patternId?: string;
  isActive: boolean;
};

export type TankData = {
  id: string;
  elevation: number;
  initialLevel: number;
  minLevel: number;
  maxLevel: number;
  diameter: number;
  minVolume: number;
  volumeCurveId?: string;
  overflow?: boolean;
  isActive: boolean;
};

export type ReservoirData = {
  id: string;
  baseHead: number;
  patternId?: string;
  isActive: boolean;
};

export type JunctionData = {
  id: string;
  elevation: number;
  baseDemand?: number | undefined;
  patternId?: string | undefined;
  isActive: boolean;
};

export type ValveData = {
  id: string;
  startNodeDirtyId: string;
  endNodeDirtyId: string;
  diameter: number;
  kind: ValveKind;
  setting: number;
  minorLoss: number;
  isActive: boolean;
};

export type CustomerPointData =
  | {
      label: string;
      coordinates: [number, number];
      baseDemand: number;
      pipeId: string;
      junctionId: string;
      snapPoint: [number, number];
    }
  | {
      label: string;
      coordinates: [number, number];
      baseDemand: number;
      pipeId?: undefined;
      junctionId?: undefined;
      snapPoint?: undefined;
    };

export type InpData = {
  junctions: JunctionData[];
  reservoirs: ReservoirData[];
  tanks: TankData[];
  pipes: PipeData[];
  pumps: PumpData[];
  valves: ValveData[];
  customerPoints: CustomerPointData[];
  coordinates: ItemData<Position>;
  vertices: ItemData<Position[]>;
  demands: ItemData<{ baseDemand: number; patternId?: string }[]>;
  patterns: ItemData<number[]>;
  status: ItemData<string>;
  curves: ItemData<{ x: number; y: number }[]>;
  options: {
    units: EpanetUnitSystem;
    headlossFormula: HeadlossFormula;
    demandMultiplier: number;
  };
  times: {
    duration: number;
    hydraulicTimestep: number;
    reportTimestep: number;
    patternTimestep: number;
  };
  nodeIds: NodeIds;
};

export type InpStats = {
  counts: Map<string, number>;
};

class NodeIds {
  private data = new Map<string, string>();

  add(dirtyId: string) {
    this.data.set(normalizeRef(dirtyId), dirtyId);
  }

  get(dirtyId: string) {
    return this.data.get(normalizeRef(dirtyId));
  }
}

export class ItemData<T> {
  private map: Map<string, T>;

  constructor() {
    this.map = new Map<string, T>();
  }

  set(dirtyId: string, data: T): void {
    this.map.set(normalizeRef(dirtyId), data);
  }

  get(dirtyId: string): T | undefined {
    return this.map.get(normalizeRef(dirtyId));
  }

  has(dirtyId: string) {
    return this.map.has(normalizeRef(dirtyId));
  }

  entries(): IterableIterator<[string, T]> {
    return this.map.entries();
  }
}

export const nullInpData = (): InpData => {
  return {
    junctions: [],
    reservoirs: [],
    tanks: [],
    pipes: [],
    pumps: [],
    valves: [],
    customerPoints: [],
    coordinates: new ItemData(),
    vertices: new ItemData(),
    demands: new ItemData(),
    patterns: new ItemData(),
    status: new ItemData(),
    curves: new ItemData(),
    options: { units: "GPM", headlossFormula: "H-W", demandMultiplier: 1 },
    times: nullEPSTiming(),
    nodeIds: new NodeIds(),
  };
};
export const normalizeRef = (id: string) => id.toUpperCase();
