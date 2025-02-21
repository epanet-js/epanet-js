import { Position } from "geojson";
import {
  HeadlossFormula,
  PipeStatus,
} from "src/hydraulic-model/asset-types/pipe";
import { EpanetUnitSystem } from "src/simulation/build-inp";

export type InpData = {
  junctions: { id: string; elevation: number }[];
  reservoirs: { id: string; head: number }[];
  tanks: {
    id: string;
    elevation: number;
    initialLevel: number;
    minimumLevel: number;
    maximumLevel: number;
    diameter: number;
    minimumVolume: number;
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
  demands: Record<string, number>;
  options: { units: EpanetUnitSystem; headlossFormula: HeadlossFormula };
};
