import { memberOf } from "../members";
import type { Section } from "../types";

const network = memberOf("Network");

export const SECTION: Section = {
  id: "network-overview",
  number: "1.1",
  title: "Overview",
  intro:
    "Start the first script on an unfamiliar model with `console.log(network.stats)` and `console.log(network.units)`.",
  types: [
    {
      name: "ProjectInfo",
      definition: `interface ProjectInfo {
  name: string;
  fileName: string | null;
  source: "project" | "inp" | "new";
  isDemo: boolean;
  unitSystem: string;
  headlossFormula: "H-W" | "D-W" | "C-M";
}`,
      summary:
        "The open project. `source` is where it came from: a saved project, an imported INP, or a new one.",
    },
    {
      name: "NetworkStats",
      definition: `interface NetworkStats {
  junctions: number;
  reservoirs: number;
  tanks: number;
  pipes: number;
  pumps: number;
  valves: number;
  customerPoints: number;
  bounds: BBox | null;
}`,
      summary: "Counts per type and the network's extent.",
    },
    {
      name: "Units",
      definition: "type Units = Readonly<Record<string, string | null>>;",
      summary: "Quantity → unit for every value the API hands out.",
      description: `The keys: \`diameter\` (pipes, valves), \`tankDiameter\` (tanks), \`length\`, \`elevation\`, \`head\`, \`pressure\`, \`flow\`, \`velocity\`, \`headloss\`, \`unitHeadloss\`, \`baseDemand\`, \`directDemand\`, \`actualDemand\`, \`customerDemand\`, \`customerDemandPerDay\`, \`initialLevel\`, \`minLevel\`, \`maxLevel\`, \`level\`, \`minVolume\`, \`volume\`, \`tankArea\`, \`area\` (zones; m² or ft² by the length unit), \`power\`, \`speed\`, \`efficiency\`, \`roughness\`, \`minorLoss\`, \`emitterCoefficient\`, \`mixingFraction\`, \`tcvSetting\`, \`averageKwPerFlowUnit\`, \`waterAge\`, \`waterTrace\`, \`chemicalConcentration\`, \`netFlow\`, \`actualHead\`, \`status\`.

Mind the mapping: a tank's \`diameter\` is in \`units.tankDiameter\`, a pipe's in \`units.diameter\`.`,
    },
    {
      name: "SimulationSettings",
      definition: `interface SimulationSettings {
  version: string;
  duration: number;
  hydraulicTimestep: number;
  reportTimestep: number;
  patternTimestep: number;
  qualityTimestep: number | null;
  ruleTimestep: number | null;
  globalDemandMultiplier: number;
  demandModel: "DDA" | "PDA";
  minimumPressure: number;
  requiredPressure: number;
  pressureExponent: number;
  emitterExponent: number;
  backflowAllowed: boolean;
  trials: number;
  accuracy: number;
  unbalancedMode: "STOP" | "CONTINUE";
  unbalancedExtraTrials: number;
  headError: number;
  flowChange: number;
  checkFreq: number;
  maxCheck: number;
  dampLimit: number;
  viscosity: number;
  specificGravity: number;
  quality: "none" | "chemical" | "age" | "trace";
  qualityChemicalName: string;
  qualityMassUnit: "mg/L" | "ug/L";
  qualityTraceNode: string | null;
  tolerance: number;
  diffusivity: number;
  reactionBulkOrder: number;
  reactionWallOrder: number;
  reactionTankOrder: number;
  reactionGlobalBulk: number;
  reactionGlobalWall: number;
  reactionLimitingPotential: number;
  reactionRoughnessCorrelation: number;
  reportEnergy: boolean;
  energyGlobalEfficiency: number;
  energyGlobalPrice: number;
  energyGlobalPattern: string | null;
  energyDemandCharge: number;
  statusReport: "YES" | "NO" | "FULL";
}`,
      summary:
        "The simulation settings the next run would use, with unset hydraulic options resolved to what EPANET uses.",
      description:
        "Times are in seconds. `qualityTraceNode` is a node label and `energyGlobalPattern` a pattern label. Scripts cannot run a simulation or read results yet.",
    },
  ],
  members: [
    network({
      name: "name",
      signature: "readonly name: string",
      summary: "The project's name — use it for report titles and file names.",
    }),
    network({
      name: "project",
      signature: "readonly project: ProjectInfo",
      summary:
        "The open project: name, file, source, units and headloss formula.",
    }),
    network({
      name: "stats",
      signature: "readonly stats: NetworkStats",
      summary: "Counts per asset type and the network's extent.",
    }),
    network({
      name: "units",
      signature: "readonly units: Units",
      summary: "Quantity → unit for every value the API hands out.",
    }),
    network({
      name: "simulation",
      signature: "readonly simulation: SimulationSettings",
      summary: "The simulation settings the next run would use.",
    }),
  ],
};
