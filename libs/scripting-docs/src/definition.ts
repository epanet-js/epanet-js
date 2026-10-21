import { exampleScripts } from "./example-scripts";
import { GLOBALS, INTERFACES } from "./interfaces";
import { SECTION as ASSETS } from "./sections/assets";
import { SECTION as COLLECTIONS } from "./sections/collections";
import { SECTION as EXPORT } from "./sections/export";
import { SECTION as LIBRARIES } from "./sections/libraries";
import {
  COLLECTIONS_SECTION,
  CONSOLE_SECTION,
  ERRORS_SECTION,
  MAP_SECTION,
  SELECTION_SECTION,
  UI_SECTION,
} from "./sections/output";
import { SECTION as OVERVIEW } from "./sections/overview";
import { SECTION as REVIEW } from "./sections/review";
import { SECTION as SCRIPT_RUNS } from "./sections/script-runs";
import { SECTION as SPATIAL } from "./sections/spatial";
import { SECTION as TOPOLOGY } from "./sections/topology";
import { SECTION as ZONES } from "./sections/zones";
import type { ScriptingDocs } from "./types";

const AGENT_RULES = [
  "Orient once: start the first script on an unfamiliar model with `console.log(network.stats)` and `console.log(network.units)`.",
  "Check `network.units` before hard-coding a threshold. A pipe diameter of 100 is 100 mm in one project and 100 in in another.",
  "Prefer `getNode`/`getLink` over `get`; never persist `uid`s; address assets by label.",
  "Everything is read-only. If the user asks to change the model, say so — do not write a script that assigns to asset fields.",
  "No `Date.now()`, `new Date()` or `Math.random()`: they throw in this sandbox.",
  "`JSON.stringify(asset)` is `{}`. Map assets to plain objects of the fields you need before serialising.",
  "Use the app's own checks instead of re-implementing them: `network.validate()`, `findOrphanAssets()`, `findSubnetworks()`, `findProximityAnomalies({ distance })`, `findCrossingPipes()`, `trace`, `boundaryLinks`, `shortestPath`.",
  "`network.validate()`'s `findings[0]` is the worst problem; `code` is stable; `assets` names what to fix.",
  "Read `pipe.appliedRoughness`, not `pipe.roughness`, for the value EPANET receives.",
  "Junction demand is `junction.demands` (categories with patterns) plus the demand of `junction.customerPoints`; `junction.baseDemand` is the categories only.",
  "Hand results back visually: `selection.set(...)` and `map.zoomTo(...)` for what to look at, `ui.attachFile` for data, `collections.saveSelectionSet` and `collections.saveBookmark` for a set or a view the user will want again, `console.table` for a summary.",
  'When the user says "the selected …", start from `selection.*` and fail clearly when it is empty or the wrong type.',
  'When the user names a DMA or a zone, look in `zones` (the drawn polygons); `network.trace` is a different, connectivity-based "zone".',
];

export const scriptingDocs: ScriptingDocs = {
  title: "epanet-js scripting API",
  summary:
    "Sandboxed JavaScript scripting for epanet-js, a browser-based water network modelling app built on the EPANET engine. A script reads the open network — assets, patterns, curves, controls, the pipe library, settings — queries it spatially and topologically, reads the project's zones, runs the app's own review checks, exports it as INP, and hands results back as the map selection, a zoom, console output and attached files. This version is read-only: scripts cannot edit the model or run a simulation. Experimental — names may change.",
  intro:
    "This is the complete surface a script sees. Everything below is injected into the sandbox; nothing else exists.",
  globals: GLOBALS,
  interfaces: INTERFACES,
  sections: [
    SCRIPT_RUNS,
    { id: "network", number: "1", title: "`network` — the model" },
    OVERVIEW,
    COLLECTIONS,
    ASSETS,
    LIBRARIES,
    SPATIAL,
    TOPOLOGY,
    REVIEW,
    EXPORT,
    ZONES,
    SELECTION_SECTION,
    MAP_SECTION,
    CONSOLE_SECTION,
    UI_SECTION,
    COLLECTIONS_SECTION,
    ERRORS_SECTION,
  ],
  agentRules: AGENT_RULES,
  exampleScripts,
};
