import type {
  AssetId,
  CustomerPointId,
  HeadlossFormula,
  ModelFactories,
  PatternId,
  Zones,
} from "@epanet-js/hydraulic-model";
import type { UnitsSpec } from "@epanet-js/project-settings";
import type { Projection } from "@epanet-js/projections";
import type { SimulationSettings } from "@epanet-js/simulation";
import type { HydraulicModel } from "src/hydraulic-model";

export type ScriptConsoleLevel = "log" | "warn" | "error";

export type ScriptEvent =
  | { type: "console"; level: ScriptConsoleLevel; text: string }
  | { type: "console-table"; columns: string[]; rows: string[][] }
  | { type: "progress"; fraction: number; message: string | null };

export type ScriptAttachment = { name: string; content: string };

export type ScriptSelectionSet = { label: string; targets: ScriptTargets };

export type ScriptBBox = [
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
];

export type ScriptBookmark = { label: string; bbox: ScriptBBox };

export type ScriptViewport = {
  bounds: ScriptBBox;
  center: [lng: number, lat: number];
  zoom: number;
};

export type ScriptTargets = {
  assetIds: AssetId[];
  customerPointIds: CustomerPointId[];
};

export type ScriptProject = {
  name: string;
  fileName: string | null;
  source: "project" | "inp" | "new";
  isDemo: boolean;
  unitSystem: string;
  headlossFormula: HeadlossFormula;
};

export type ScriptSimulationSettings = {
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
  qualityTraceNodeId: AssetId | null;
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
  energyGlobalPatternId: PatternId | null;
  energyDemandCharge: number;
  statusReport: "YES" | "NO" | "FULL";
};

export type ScriptSimulationStatus =
  | "success"
  | "warning"
  | "failure"
  | "stopped";

export type ScriptGated<T> = { isOn: false } | { isOn: true; value: T };

export type ScriptLastResults = {
  status: ScriptSimulationStatus;
  report: string;
  isStale: boolean;
  location: { appId: string; scenarioKey: string; runId: string } | null;
};

export type ScriptRunOutcome =
  | {
      status: "success";
      selection: ScriptTargets | null;
      zoomTo:
        | ((
            | { type: "targets"; targets: ScriptTargets }
            | { type: "bbox"; bbox: ScriptBBox }
          ) & { maxZoom: number | null })
        | null;
      attachments: ScriptAttachment[];
      selectionSets: ScriptSelectionSet[];
      bookmarks: ScriptBookmark[];
    }
  | {
      status: "error";
      error: { name: string; message: string; line: number | null };
    }
  | { status: "cancelled" };

export type ScriptRunHandle = {
  finished: Promise<ScriptRunOutcome>;
  cancel: () => void;
};

export type ExampleScript = {
  id: string;
  name: string;
  source: string;
  paid: boolean;
};

export type Scripting = {
  startScriptRun: (input: {
    source: string;
    model: HydraulicModel;
    factories: ModelFactories;
    units: UnitsSpec;
    selected: ScriptTargets;
    selectionSets: ScriptSelectionSet[];
    bookmarks: ScriptBookmark[];
    viewport: ScriptViewport | null;
    project: ScriptProject;
    simulation: ScriptSimulationSettings;
    inp: { simulationSettings: SimulationSettings; projection: Projection };
    zones: Zones;
    lastResults: ScriptGated<ScriptLastResults | null>;
    onEvent: (event: ScriptEvent) => void;
  }) => ScriptRunHandle;
  exampleScripts: ExampleScript[];
};

let scripting: Scripting | null = null;

export const registerScripting = (implementation: Scripting): void => {
  scripting = implementation;
};

export const getScripting = (): Scripting | null => scripting;
