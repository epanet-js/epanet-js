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
    startNodeDirtyId: string;
    endNodeDirtyId: string;
    length: number;
    diameter: number;
    roughness: number;
    minorLoss: number;
    status: PipeStatus;
  }[];
  coordinates: ItemData<Position>;
  vertices: ItemData<Position[]>;
  demands: ItemData<{ baseDemand: number; patternId?: string }[]>;
  patterns: ItemData<number[]>;
  options: { units: EpanetUnitSystem; headlossFormula: HeadlossFormula };
  nodeIds: NodeIds;
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
    coordinates: new ItemData(),
    vertices: new ItemData(),
    demands: new ItemData(),
    patterns: new ItemData(),
    options: { units: "GPM", headlossFormula: "H-W" },
    nodeIds: new NodeIds(),
  };
};
export const normalizeRef = (id: string) => id.toUpperCase();
