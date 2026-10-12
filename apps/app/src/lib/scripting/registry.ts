import type { AssetId, ModelFactories } from "@epanet-js/hydraulic-model";
import type { UnitsSpec } from "@epanet-js/project-settings";
import type { HydraulicModel } from "src/hydraulic-model";

export type ScriptConsoleLevel = "log" | "warn" | "error";

export type ScriptEvent =
  | { type: "console"; level: ScriptConsoleLevel; text: string }
  | { type: "progress"; fraction: number };

export type ScriptAttachment = { name: string; content: string };

export type ScriptRunOutcome =
  | {
      status: "success";
      selection: AssetId[] | null;
      zoomTo: AssetId[] | null;
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
    onEvent: (event: ScriptEvent) => void;
  }) => ScriptRunHandle;
  exampleScripts: ExampleScript[];
};

let scripting: Scripting | null = null;

export const registerScripting = (implementation: Scripting): void => {
  scripting = implementation;
};

export const getScripting = (): Scripting | null => scripting;
