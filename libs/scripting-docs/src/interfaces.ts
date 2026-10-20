import type { GlobalDef, InterfaceDef } from "./types";

export const GLOBALS: GlobalDef[] = [
  {
    name: "network",
    type: "Network",
    summary:
      "the model: collections, lookup, spatial and topology queries, the review checks, INP export",
    section: "network",
  },
  {
    name: "selection",
    type: "Selection",
    summary: "the map selection — the user's as input, the script's as output",
    section: "selection",
  },
  {
    name: "map",
    type: "ScriptMap",
    summary: "the viewport at run start; `zoomTo` applied when the script ends",
    section: "map",
  },
  {
    name: "console",
    type: "ScriptConsole",
    summary: "log, warn, error and table, streamed into the run dialog",
    section: "console",
  },
  {
    name: "ui",
    type: "Ui",
    summary: "progress, and files offered for download when the script ends",
    section: "ui",
  },
  {
    name: "collections",
    type: "Collections",
    summary: "selection sets saved to the project when the script ends",
    section: "collections",
  },
];

export const INTERFACES: InterfaceDef[] = [
  {
    name: "Network",
    path: "network",
    summary: "The model the script reads.",
  },
  {
    name: "NetworkGeo",
    path: "network.geo",
    summary: "Geodesic helpers in the project length unit.",
  },
  {
    name: "Selection",
    path: "selection",
    summary:
      "The map selection: the user's when the script started, then the script's own after `set`, `add` or `clear`.",
  },
  {
    name: "ScriptMap",
    path: "map",
    summary: "The viewport at run start, and the zoom applied when it ends.",
  },
  {
    name: "ScriptConsole",
    path: "console",
    summary: "Output streamed live into the run dialog.",
  },
  {
    name: "Ui",
    path: "ui",
    summary: "Progress and attached files.",
  },
  {
    name: "Collections",
    path: "collections",
    summary: "Selection sets saved to the project when the script ends.",
  },
  {
    name: "Asset",
    path: "asset",
    summary: "What every asset carries.",
  },
  {
    name: "NodeAsset",
    path: "node",
    extends: "Asset",
    summary: "A junction, reservoir or tank.",
  },
  {
    name: "Junction",
    path: "junction",
    extends: "NodeAsset",
    summary: "A demand node.",
  },
  {
    name: "Reservoir",
    path: "reservoir",
    extends: "NodeAsset",
    summary: "A fixed-head source.",
  },
  {
    name: "Tank",
    path: "tank",
    extends: "NodeAsset",
    summary: "A storage node.",
  },
  {
    name: "LinkAsset",
    path: "link",
    extends: "Asset",
    summary: "A pipe, pump or valve.",
  },
  {
    name: "Pipe",
    path: "pipe",
    extends: "LinkAsset",
    summary: "A pipe.",
  },
  {
    name: "Pump",
    path: "pump",
    extends: "LinkAsset",
    summary: "A pump.",
  },
  {
    name: "Valve",
    path: "valve",
    extends: "LinkAsset",
    summary: "A valve; its setting unit follows its kind.",
  },
  {
    name: "CustomerPoint",
    path: "customerPoint",
    summary:
      "A customer: a point carrying demand, allocated to a pipe and through it to a junction.",
  },
];
