import { memberOf, propertyOf } from "../members";
import type { Section } from "../types";

const selection = memberOf("Selection");
const selected = propertyOf("Selection");
const map = memberOf("ScriptMap");
const viewport = propertyOf("ScriptMap");
const consoleMember = memberOf("ScriptConsole");
const ui = memberOf("Ui");

const Targets = "Asset | CustomerPoint | (Asset | CustomerPoint)[]";

export const SELECTION_SECTION: Section = {
  id: "selection",
  number: "2",
  title: "`selection` — the user's selection in, the script's out",
  members: [
    selected("assets", "Asset[]", "The selected assets."),
    selected(
      "customerPoints",
      "CustomerPoint[]",
      "The selected customer points.",
    ),
    selected("nodes", "NodeAsset[]", "The selected nodes."),
    selected("links", "LinkAsset[]", "The selected links."),
    selected("junctions", "Junction[]", "The selected junctions."),
    selected("reservoirs", "Reservoir[]", "The selected reservoirs."),
    selected("tanks", "Tank[]", "The selected tanks."),
    selected("pipes", "Pipe[]", "The selected pipes."),
    selected("pumps", "Pump[]", "The selected pumps."),
    selected("valves", "Valve[]", "The selected valves."),
    selected("labels", "string[]", "The labels of everything selected."),
    selected("count", "number", "How many things are selected."),
    selected("isEmpty", "boolean", "Whether nothing is selected."),
    selection({
      name: "set",
      signature: `set(targets: ${Targets}): void`,
      summary: "Replace the selection.",
      throws: [
        "`selection.set expects assets or customer points from the network`",
      ],
    }),
    selection({
      name: "add",
      signature: `add(targets: ${Targets}): void`,
      summary: "Add to the selection.",
    }),
    selection({
      name: "clear",
      signature: "clear(): void",
      summary: "Select nothing.",
    }),
  ],
  notes: `At run start the selection is the user's. After \`set\`, \`add\` or \`clear\`, the getters (and \`asset.isSelected\`) read the script's selection, and the map shows it when the script ends.

When the user says "the selected pipes", start from \`selection.pipes\`, and throw a clear error when it is empty: \`if (selection.pipes.length === 0) throw new Error("Select some pipes first")\`.`,
};

export const MAP_SECTION: Section = {
  id: "map",
  number: "3",
  title: "`map` — the viewport",
  members: [
    viewport("bounds", "BBox | null", "The viewport at run start."),
    viewport("center", "Position | null", "The centre of the viewport."),
    viewport("zoom", "number | null", "The zoom level."),
    map({
      name: "zoomTo",
      signature: `zoomTo(target: ${Targets} | BBox, options?: { maxZoom?: number }): void`,
      summary:
        "Zoom to assets, customer points or a box when the script ends. The last call wins.",
      throws: [
        "`map.zoomTo expects assets, customer points or a [minLng, minLat, maxLng, maxLat] box`",
      ],
    }),
  ],
};

export const CONSOLE_SECTION: Section = {
  id: "console",
  number: "4",
  title: "`console` — output",
  members: [
    consoleMember({
      name: "log",
      signature: "log(...args: unknown[]): void",
      summary:
        "A line in the run's console, streamed live. Assets and customer points print as their labels; objects print as JSON, with assets inside as labels.",
    }),
    consoleMember({
      name: "warn",
      signature: "warn(...args: unknown[]): void",
      summary: "A warning line.",
    }),
    consoleMember({
      name: "error",
      signature: "error(...args: unknown[]): void",
      summary: "An error line.",
    }),
    consoleMember({
      name: "table",
      signature: "table(rows: unknown[], columns?: string[]): void",
      summary:
        "A table. `rows` is an array of objects or of plain values; `columns` picks and orders the keys. Asset cells print as labels.",
    }),
  ],
  notes:
    "`JSON.stringify(asset)` gives `{}` — assets are getters, not data. Build plain objects of the fields you need (`{ pipe: p.label, diameter: p.diameter }`), or pass the asset to `console`/`ui.attachFile`, which print labels.",
};

export const UI_SECTION: Section = {
  id: "ui",
  number: "5",
  title: "`ui` — progress and files",
  members: [
    ui({
      name: "progress",
      signature: "progress(fraction: number, message?: string): void",
      summary: "Show progress between 0 and 1 in the run dialog.",
      description:
        "Calls closer than 50 ms apart with the same message are dropped, so calling it every iteration is fine.",
    }),
    ui({
      name: "attachFile",
      signature: "attachFile(name: string, content: string | object): void",
      summary: "Offer a file for download when the script ends.",
      description:
        "`content` is a string, or an object or array written as indented JSON (assets inside become labels). The name is 1–128 characters; attaching the same name again replaces the file.",
    }),
  ],
  notes:
    "Deliver tabular or geographic output as files — CSV, GeoJSON, JSON, INP — and keep `console.table` for at-a-glance summaries.",
};

export const ERRORS_SECTION: Section = {
  id: "errors",
  number: "6",
  title: "Errors and limits",
  intro: `- **An uncaught error stops the script.** The run dialog shows \`name: message\` and the script line it came from. Selection, zoom and attachments are not applied; console lines already printed stay.
- **API misuse throws early with a specific message**, quoted under each member's **Throws**.
- **Cancellation:** the run dialog's Cancel stops the script immediately. There is no time limit.
- **Caps:** a console line keeps its first 10,000 characters; the run dialog keeps the last 1,000 console entries; \`console.table\` shows the first 1,000 rows and says how many it left out; a progress message keeps 200 characters.`,
};
