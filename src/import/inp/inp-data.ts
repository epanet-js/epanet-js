import { Position } from "geojson";
import {
  HeadlossFormula,
  PipeStatus,
} from "src/hydraulic-model/asset-types/pipe";
import { isFeatureOn } from "src/infra/feature-flags";
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
  vertices: Record<string, Position[]>;
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

  private normalize(dirtyId: string) {
    if (isFeatureOn("FLAG_CASE_IDS")) {
      return dirtyId.toUpperCase();
    } else {
      return dirtyId;
    }
  }
}

export const nullInpData = (): InpData => {
  return {
    junctions: [],
    reservoirs: [],
    tanks: [],
    pipes: [],
    coordinates: new ItemData<Position>(),
    vertices: {},
    demands: {},
    patterns: {},
    options: { units: "GPM", headlossFormula: "H-W" },
    nodeIds: new Map(),
  };
};
