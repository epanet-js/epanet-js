import type {
  AssetId,
  CustomerPointId,
  HeadlossFormula,
  ModelFactories,
} from "@epanet-js/hydraulic-model";
import type { UnitsSpec } from "@epanet-js/project-settings";
import type { HydraulicModel } from "src/hydraulic-model";

export type ScriptConsoleLevel = "log" | "warn" | "error";

export type ScriptEvent =
  | { type: "console"; level: ScriptConsoleLevel; text: string }
  | { type: "console-table"; columns: string[]; rows: string[][] }
  | { type: "progress"; fraction: number; message: string | null };

export type ScriptAttachment = { name: string; content: string };

export type ScriptBBox = [
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
];

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

export type ExampleScript = { id: string; name: string; source: string };

export type Scripting = {
  startScriptRun: (input: {
    source: string;
    model: HydraulicModel;
    factories: ModelFactories;
    units: UnitsSpec;
    selected: ScriptTargets;
    viewport: ScriptViewport | null;
    project: ScriptProject;
    onEvent: (event: ScriptEvent) => void;
  }) => ScriptRunHandle;
  exampleScripts: ExampleScript[];
};

let scripting: Scripting | null = null;

export const registerScripting = (implementation: Scripting): void => {
  scripting = implementation;
};

export const getScripting = (): Scripting | null => scripting;
