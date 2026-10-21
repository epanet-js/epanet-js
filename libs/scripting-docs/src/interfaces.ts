import type { GlobalDef, InterfaceDef } from "./types";

export const GLOBALS: GlobalDef[] = [
  {
    name: "network",
    type: "Network",
    summary:
      "the model: lists, lookup, spatial and topology queries, the review checks, INP export",
    section: "network",
  },
  {
    name: "zones",
    type: "Zones",
    summary: "the project's polygon zones: list, get, at, contains",
    section: "zones",
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
    summary:
      "the project's selection sets and bookmarks, and new ones saved when the script ends",
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
    name: "Zones",
    path: "zones",
    summary: "The project's polygon zones.",
  },
  {
    name: "Zone",
    path: "zone",
    summary: "One polygon zone.",
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
    summary:
      "The project's selection sets and bookmarks, and new ones saved when the script ends.",
  },
  {
    name: "SelectionSet",
    path: "selectionSet",
    summary:
      "A saved selection set: its label and the members still in the model.",
  },
  {
    name: "Bookmark",
    path: "bookmark",
    summary: "A saved map view: its label and box.",
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
