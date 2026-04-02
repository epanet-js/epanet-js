import { Position } from "geojson";
import {
  HeadlossFormula,
  PipeStatus,
} from "src/hydraulic-model/asset-types/pipe";
import { ValveKind } from "src/hydraulic-model/asset-types/valve";
import { CurveType } from "src/hydraulic-model/curves";
import { PatternType } from "src/hydraulic-model/patterns";
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
  elevation?: number;
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
  curveId?: string;
  isActive: boolean;
};

export type CurveData = {
  label: string;
  points: { x: number; y: number }[];
  fallbackType?: CurveType;
};

export type PatternData = {
  label: string;
  multipliers: number[];
  fallbackType?: PatternType;
};

export type DemandData = {
  patternLabel?: string;
  baseDemand: number;
};

export type CustomerPointData =
  | {
      label: string;
      coordinates: [number, number];
      baseDemand: number;
      demands?: DemandData[];
      pipeId: string;
      junctionId: string;
      snapPoint: [number, number];
    }
  | {
      label: string;
      coordinates: [number, number];
      baseDemand: number;
      demands?: DemandData[];
      pipeId?: undefined;
      junctionId?: undefined;
      snapPoint?: undefined;
    };

export type PumpEnergyData = {
  efficiencyCurve?: string;
  pattern?: string;
  price?: number;
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
  demands: ItemData<DemandData[]>;
  customerDemands: ItemData<DemandData[]>;
  emitters: ItemData<number>;
  patterns: ItemData<PatternData>;
  status: ItemData<string>;
  curves: ItemData<CurveData>;
  quality: ItemData<number>;
  mixing: ItemData<{ model: string; fraction?: number }>;
  sourcePatterns: Set<string>;
  options: {
    units: EpanetUnitSystem;
    headlossFormula: HeadlossFormula;
    pressureUnit?: string;
    demandMultiplier: number;
    defaultPattern?: string;
    demandModel?: "DDA" | "PDA";
    minimumPressure?: number;
    requiredPressure?: number;
    pressureExponent?: number;
    emitterExponent?: number;
    backflowAllowed?: boolean;
    trials?: number;
    accuracy?: number;
    unbalancedMode?: "STOP" | "CONTINUE";
    unbalancedExtraTrials?: number;
    headError?: number;
    flowChange?: number;
    checkFreq?: number;
    maxCheck?: number;
    dampLimit?: number;
    viscosity?: number;
    specificGravity?: number;
    qualitySimulationType?: "NONE" | "CHEMICAL" | "AGE" | "TRACE";
    qualityChemicalName?: string;
    qualityMassUnit?: "mg/L" | "ug/L";
    qualityTraceNode?: string;
    tolerance?: number;
    diffusivity?: number;
  };
  reactions: {
    bulkOrder?: number;
    wallOrder?: number;
    tankOrder?: number;
    globalBulk?: number;
    globalWall?: number;
    limitingPotential?: number;
    roughnessCorrelation?: number;
  };
  energy: {
    globalEfficiency?: number;
    globalPrice?: number;
    globalPattern?: string;
    demandCharge?: number;
    pumpEnergy: ItemData<PumpEnergyData>;
  };
  times: {
    duration?: number;
    hydraulicTimestep?: number;
    reportTimestep?: number;
    patternTimestep?: number;
    qualityTimestep?: number;
    ruleTimestep?: number;
    patternStart?: number;
    reportStart?: number;
    startClocktime?: number;
    statistic?: string;
  };
  report: {
    energy?: boolean;
    statusReport?: "YES" | "NO" | "FULL";
  };
  controls: {
    simple: string;
    ruleBased: string;
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

  get isEmpty() {
    return this.map.size === 0;
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
    customerDemands: new ItemData(),
    emitters: new ItemData(),
    patterns: new ItemData(),
    status: new ItemData(),
    curves: new ItemData(),
    quality: new ItemData(),
    mixing: new ItemData(),
    sourcePatterns: new Set(),
    options: { units: "GPM", headlossFormula: "H-W", demandMultiplier: 1 },
    reactions: {},
    energy: { pumpEnergy: new ItemData() },
    times: {},
    report: {},
    controls: { simple: "", ruleBased: "" },
    nodeIds: new NodeIds(),
  };
};
export const normalizeRef = (id: string) => id.toUpperCase();
