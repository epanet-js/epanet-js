import { Position } from "geojson";
import {
  HeadlossFormula,
  PipeStatus,
} from "src/hydraulic-model/asset-types/pipe";
import { ValveType } from "src/hydraulic-model/asset-types/valve";
import { EpanetUnitSystem } from "src/simulation/build-inp";

export type PipeData = {
  id: string;
  startNodeDirtyId: string;
  endNodeDirtyId: string;
  length: number;
  diameter: number;
  roughness: number;
  minorLoss: number;
  status: PipeStatus;
};

export type PumpData = {
  id: string;
  startNodeDirtyId: string;
  endNodeDirtyId: string;
  power?: number;
  curveId?: string;
  speed?: number;
  patternId?: string;
};

export type TankData = {
  id: string;
  elevation: number;
  initialLevel: number;
};

export type ReservoirData = {
  id: string;
  baseHead: number;
  patternId?: string;
};

export type JunctionData = {
  id: string;
  elevation: number;
  baseDemand?: number | undefined;
  patternId?: string | undefined;
};

export type ValveData = {
  id: string;
  startNodeDirtyId: string;
  endNodeDirtyId: string;
  diameter: number;
  valveType: ValveType;
  setting: number;
  minorLoss: number;
};

export type InpData = {
  junctions: JunctionData[];
  reservoirs: ReservoirData[];
  tanks: TankData[];
  pipes: PipeData[];
  pumps: PumpData[];
  valves: ValveData[];
  coordinates: ItemData<Position>;
  vertices: ItemData<Position[]>;
  demands: ItemData<{ baseDemand: number; patternId?: string }[]>;
  patterns: ItemData<number[]>;
  status: ItemData<string>;
  curves: ItemData<{ x: number; y: number }[]>;
  options: { units: EpanetUnitSystem; headlossFormula: HeadlossFormula };
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
}

export const nullInpData = (): InpData => {
  return {
    junctions: [],
    reservoirs: [],
    tanks: [],
    pipes: [],
    pumps: [],
    valves: [],
    coordinates: new ItemData(),
    vertices: new ItemData(),
    demands: new ItemData(),
    patterns: new ItemData(),
    status: new ItemData(),
    curves: new ItemData(),
    options: { units: "GPM", headlossFormula: "H-W" },
    nodeIds: new NodeIds(),
  };
};
export const normalizeRef = (id: string) => id.toUpperCase();
