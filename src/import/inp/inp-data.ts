import { Position } from "geojson";
import {
  HeadlossFormula,
  PipeStatus,
} from "src/hydraulic-model/asset-types/pipe";
import { EpanetUnitSystem } from "src/simulation/build-inp";

export type InpData = {
  junctions: {
    id: string;
    elevation: number;
    baseDemand?: number | undefined;
    patternId?: string | undefined;
  }[];
  reservoirs: { id: string; baseHead: number; patternId?: string }[];
  tanks: {
    id: string;
    elevation: number;
    initialLevel: number;
  }[];
  pipes: {
    id: string;
    startNode: string;
    endNode: string;
    length: number;
    diameter: number;
    roughness: number;
    minorLoss: number;
    status: PipeStatus;
  }[];
  coordinates: ItemData<Position>;
  vertices: ItemData<Position[]>;
  demands: Record<string, { baseDemand: number; patternId?: string }[]>;
  patterns: Record<string, number[]>;
  options: { units: EpanetUnitSystem; headlossFormula: HeadlossFormula };
  nodeIds: Map<string, string>;
};

class ItemData<T> {
  private map: Map<string, T>;

  constructor() {
    this.map = new Map<string, T>();
  }

  set(dirtyId: string, data: T): void {
    this.map.set(this.normalize(dirtyId), data);
  }

  get(dirtyId: string): T | undefined {
    return this.map.get(this.normalize(dirtyId));
  }

  has(dirtyId: string) {
    return this.map.has(this.normalize(dirtyId));
  }

  private normalize(dirtyId: string) {
    return dirtyId.toUpperCase();
  }
}

export const nullInpData = (): InpData => {
  return {
    junctions: [],
    reservoirs: [],
    tanks: [],
    pipes: [],
    coordinates: new ItemData<Position>(),
    vertices: new ItemData<Position[]>(),
    demands: {},
    patterns: {},
    options: { units: "GPM", headlossFormula: "H-W" },
    nodeIds: new Map(),
  };
};
