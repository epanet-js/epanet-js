import type { AssetId, ModelFactories } from "@epanet-js/hydraulic-model";
import type { UnitsSpec } from "@epanet-js/project-settings";
import type { HydraulicModel } from "src/hydraulic-model";

export type ScriptConsoleLevel = "log" | "warn" | "error";

export type ScriptEvent =
  | { type: "console"; level: ScriptConsoleLevel; text: string }
  | { type: "console-table"; columns: string[]; rows: string[][] }
  | { type: "progress"; fraction: number };

export type ScriptAttachment = { name: string; content: string };

export type ScriptBBox = [
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
];

export type ScriptRunOutcome =
  | {
      status: "success";
      selection: AssetId[] | null;
      zoomTo:
        | { type: "assets"; ids: AssetId[] }
        | { type: "bbox"; bbox: ScriptBBox }
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
    selectedAssetIds: readonly AssetId[];
    viewport: ScriptBBox | null;
    onEvent: (event: ScriptEvent) => void;
  }) => ScriptRunHandle;
  exampleScripts: ExampleScript[];
};

let scripting: Scripting | null = null;

export const registerScripting = (implementation: Scripting): void => {
  scripting = implementation;
};

export const getScripting = (): Scripting | null => scripting;
