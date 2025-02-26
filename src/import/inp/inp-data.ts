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
  coordinates: Record<string, Position>;
  vertices: Record<string, Position[]>;
  demands: Record<string, { baseDemand: number; patternId?: string }[]>;
  patterns: Record<string, number[]>;
  options: { units: EpanetUnitSystem; headlossFormula: HeadlossFormula };
  nodeIds: Map<string, string>;
};

export const nullInpData = (): InpData => {
  return {
    junctions: [],
    reservoirs: [],
    tanks: [],
    pipes: [],
    coordinates: {},
    vertices: {},
    demands: {},
    patterns: {},
    options: { units: "GPM", headlossFormula: "H-W" },
    nodeIds: new Map(),
  };
};
