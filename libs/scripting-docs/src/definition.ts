import { SCRIPT_API_VERSION } from "./api-version";
import { exampleScripts } from "./example-scripts";
import { GLOBALS, INTERFACES } from "./interfaces";
import { SECTION as ASSETS } from "./sections/assets";
import { SECTION as COLLECTIONS } from "./sections/collections";
import { SECTION as EXPORT } from "./sections/export";
import { SECTION as CONTROLS_AND_ATTRIBUTES } from "./sections/controls-and-attributes";
import { SECTION as PIPE_LIBRARY } from "./sections/pipe-library";
import { SECTION as CUSTOM_ATTRIBUTES } from "./sections/custom-attributes";
import { SECTION as CURVES } from "./sections/curves";
import { SECTION as PATTERNS } from "./sections/patterns";
import {
  COLLECTIONS_SECTION,
  CONSOLE_SECTION,
  ERRORS_SECTION,
  MAP_SECTION,
  SELECTION_SECTION,
  UI_SECTION,
} from "./sections/output";
import { SECTION as OVERVIEW } from "./sections/overview";
import {
  interfacesFor as resultsInterfacesFor,
  sectionFor as resultsFor,
} from "./sections/results";
import { SECTION as REVIEW } from "./sections/review";
import { sectionFor as scriptRunsFor } from "./sections/script-runs";
import { SECTION as SPATIAL } from "./sections/spatial";
import { SECTION as TOPOLOGY } from "./sections/topology";
import { SECTION as ZONES } from "./sections/zones";
import { numberSections } from "./outline";
import type { DocsCandidates, ScriptingDocs } from "./types";

const EDITS_RULE =
  "Change assets only with `asset.set(...)` for the label and the attributes its `Changes` type lists, a customer point's label with `customerPoint.set(...)`, a zone's label with `zone.set(...)` and delete one with `zones.delete(...)`, custom attributes with `setCustom(...)`, the demands of a junction or customer point with `setDemands(...)`, a node's quality source with `setQualitySource(...)`, a tank's volume curve with `setVolumeCurve(...)`, a pump's definition with `setDefinition(...)` and its control with `setControl(...)`, and a valve's kind with `setKind(...)` and its control with `setControl(...)`. Add patterns with `network.addPattern(...)`, change one with `pattern.set(...)` and delete one with `network.deletePattern(...)`, and add curves with `network.addCurve(...)`, change one with `curve.set(...)` and delete one with `network.deleteCurve(...)`. Add pipe library materials with `network.addPipeMaterial(...)`, change one with `material.set(...)` and delete one with `network.deletePipeMaterial(...)`. Replace the `[CONTROLS]` lines with `network.setRawControls(...)` and the `[RULES]` blocks with `network.setRawRules(...)`. Define custom attributes with `network.addCustomAttribute(...)`, rename one with `attribute.set(...)` and delete one with `network.deleteCustomAttribute(...)`; all three are refused while the project has scenarios. Everything else is read-only. If the user asks for another change, say so — never assign to asset fields.";

const SIMULATE_RULE =
  "Run a simulation with `await network.simulate()` only when the task needs results for the model as the script changes it. Await each call before the next, never start two at once, and check the run's `status` before reading values. When the user wants the app to show results for the changed model, end the script with `await network.simulate()`: a change after the last run leaves the app's results as they were.";

const AGENT_RULES = [
  "Orient once: start the first script on an unfamiliar model with `console.log(network.stats)` and `console.log(network.units)`.",
  "Check `network.units` before hard-coding a threshold. A pipe diameter of 100 is 100 mm in one project and 100 in in another.",
  "Prefer `getNode`/`getLink` over `get`; never persist `uid`s; address assets by label.",
  EDITS_RULE,
  "No `Date.now()`, `new Date()` or `Math.random()`: they throw in this sandbox.",
  "`JSON.stringify(asset)` is `{}`. Map assets to plain objects of the fields you need before serialising.",
  "Use the app's own checks instead of re-implementing them: `network.validate()`, `findOrphanAssets()`, `findSubnetworks()`, `findProximityAnomalies({ distance })`, `findCrossingPipes()`, `trace`, `boundaryLinks`, `shortestPath`.",
  "Walk the pipes with `network.trace`, never with your own search over `junction.links`: `stopAt`, `maxDistance` and `maxHops` set where it stops, `stoppedAt` says where and why it stopped, `distance(node)` how far along the pipes a node is.",
  "`network.validate()`'s `findings[0]` is the worst problem; `code` is stable; `assets` names what to fix.",
  "Read `pipe.appliedRoughness`, not `pipe.roughness`, for the value EPANET receives.",
  "Junction demand is `junction.demands` (categories with patterns) plus the demand of `junction.customerPoints`; `junction.baseDemand` is the categories only.",
  "Hand results back visually: `selection.set(...)` and `map.zoomTo(...)` for what to look at, `ui.attachFile` for data, `collections.saveSelectionSet` and `collections.saveBookmark` for a set or a view the user will want again, `console.table` for a summary.",
  "Leave `collections.saveSelectionSet` and `collections.saveBookmark` uncommitted: the user picks what is worth keeping from the run's output. Pass `{ commit: true }` only when the user asks for them to be saved to the project.",
  'When the user says "the selected …", start from `selection.*` and fail clearly when it is empty or the wrong type.',
  'When the user names a DMA or a zone, look in `zones` (the drawn polygons); `network.trace` is a different, connectivity-based "zone".',
];

const buildDocs = (candidates: DocsCandidates): ScriptingDocs => ({
  title: "epanet-js scripting API",
  apiVersion: SCRIPT_API_VERSION,
  summary: `Sandboxed JavaScript scripting for epanet-js, a browser-based water network modelling app built on the EPANET engine. A script reads the open network — assets, patterns, curves, controls, the pipe library, settings — queries it spatially and topologically, reads the project's zones, runs the app's own review checks, reads the last simulation's results, exports it as INP, and hands results back as the map selection, a zoom, console output and attached files. Scripts can change asset attributes, asset, customer point and zone labels and pump controls, delete zones, add, change and delete patterns, add, change and delete curves, add, change and delete pipe library materials, replace the \`[CONTROLS]\` lines and \`[RULES]\` blocks, and add, rename and delete custom attributes; they cannot otherwise edit the model${candidates.simulations ? ". Scripts can also run a simulation of the network as they have changed it and read its results." : " or run a simulation."}`,
  intro:
    "This is the complete surface a script sees. Everything below is injected into the sandbox; nothing else exists.",
  globals: GLOBALS,
  interfaces: [...INTERFACES, ...resultsInterfacesFor(candidates)],
  sections: numberSections({
    preface: [scriptRunsFor(candidates)],
    chapters: [
      {
        id: "network",
        title: "`network` — the model",
        subsections: [
          OVERVIEW,
          COLLECTIONS,
          ASSETS,
          PATTERNS,
          CURVES,
          PIPE_LIBRARY,
          CONTROLS_AND_ATTRIBUTES,
          CUSTOM_ATTRIBUTES,
          SPATIAL,
          TOPOLOGY,
          REVIEW,
          EXPORT,
          resultsFor(candidates),
        ],
      },
      ZONES,
      SELECTION_SECTION,
      MAP_SECTION,
      CONSOLE_SECTION,
      UI_SECTION,
      COLLECTIONS_SECTION,
      ERRORS_SECTION,
    ],
  }),
  agentRules: candidates.simulations
    ? [...AGENT_RULES, SIMULATE_RULE]
    : AGENT_RULES,
  exampleScripts,
});

export const scriptingDocs = buildDocs({ simulations: false });

export const simulationsCandidateDocs = buildDocs({ simulations: true });
