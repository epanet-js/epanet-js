import { memberOf } from "../members";
import type { Section } from "../types";

const network = memberOf("Network");

export const SECTION: Section = {
  id: "topology",
  number: "1.6",
  title: "Topology and tracing",
  types: [
    {
      name: "BoundaryLink",
      definition:
        "interface BoundaryLink { link: LinkAsset; inside: NodeAsset; outside: NodeAsset }",
      summary:
        "A link on the rim of a set of nodes. For a PRV on the rim, `inside` is the zone end.",
    },
    {
      name: "StopPreset",
      definition: `type StopPreset =
  | "tanks" | "reservoirs" | "pumps"
  | "valves" | "controlValves" | "cv" | "closed"
  | "prv" | "psv" | "fcv" | "pbv" | "tcv" | "gpv" | "pcv";`,
      summary:
        'Named barriers for `trace`\'s `stopAt`. `controlValves` is every valve except an open TCV; `cv` is check-valve pipes; `closed` is closed pipes and valves and pumps that are off, for `mode: "connected"`.',
    },
    {
      name: "TraceStop",
      definition: `interface TraceStop {
  asset: Asset;
  reason: "stopAt" | "closed" | "direction" | "limit";
  from: NodeAsset;
  via: LinkAsset | null;
}`,
      summary:
        "Where a trace stopped and why: the barrier, and the node it was reached from.",
      description:
        "`stopAt`: the asset matched a preset or function. `closed`: a closed pipe or valve, or a pump that is off. `direction`: a one-way link (a pump, a check-valve pipe, any valve except a TCV) reached from its end node. `closed` and `direction` only come from the default mode. `limit`: a node past `maxDistance` or `maxHops`. `via` is the link that led to a node barrier, and `null` when the barrier is the link itself.",
    },
    {
      name: "TraceResult",
      definition:
        "interface TraceResult { nodes: NodeAsset[]; links: LinkAsset[]; boundaryLinks: BoundaryLink[]; stoppedAt: TraceStop[]; distance(node: NodeAsset | string): number }",
      summary:
        "The zone a trace reached, the links on its rim, every barrier it stopped at, and how far along the pipes each node is.",
      description:
        "`nodes` come nearest first; `links` in the order they were crossed. `distance(node)` is the distance along the pipes from the nearest start, in the project length unit (pipe lengths; pumps and valves count 0), and `Infinity` for a node the trace did not reach. Each barrier is in `stoppedAt` once. A one-way link the trace later crossed from its start node is not in it.",
    },
    {
      name: "Path",
      definition:
        "interface Path { nodes: NodeAsset[]; links: LinkAsset[]; totalLength: number }",
      summary: "A path between two nodes.",
      description:
        "`totalLength` is the length along the pipes, in the project length unit (pumps and valves count 0), whatever `weightBy` the path was found with.",
    },
  ],
  members: [
    network({
      name: "trace",
      signature:
        'trace(start: Asset | string | (Asset | string)[], options?: { mode?: "allowed" | "connected"; stopAt?: (StopPreset | ((asset: Asset) => boolean))[]; maxDistance?: number; maxHops?: number }): TraceResult',
      summary:
        "The walk over the pipes to reach for. By default it is the app's Trace tool, boundary mode: the pressure zone around `start`.",
      description:
        'By default it grows through open links in the direction water may flow, never crossing a closed link or a one-way link from its end node; `mode: "connected"` crosses both. It stops at every barrier in `stopAt`. Barrier nodes are not included. `stoppedAt` says where it stopped and why. A start node that is itself a barrier is left out, as in the Trace tool; a start link is always included.',
      params: [
        {
          name: "options.mode",
          description:
            '`"allowed"`, the default: through open links in the direction water may flow. `"connected"`: everything connected on the drawing, through closed links and one-way links either way; `stopAt` still applies. `"upstream"` and `"downstream"` need simulation results and throw.',
        },
        {
          name: "options.stopAt",
          description:
            'Presets and functions that make an asset a barrier. The default, `["tanks", "reservoirs", "pumps", "controlValves"]`, is the Trace tool\'s boundary. `[]` follows the water through everything passable, pumps and valves only from their start node. A function gets each node and link the trace reaches and returns `true` to stop there.',
        },
        {
          name: "options.maxDistance",
          description:
            "Go no further than this along the pipes from the nearest start, in the project length unit (pipe lengths; pumps and valves count 0). No limit by default.",
        },
        {
          name: "options.maxHops",
          description:
            "Cross at most this many links from the nearest start, counted along the path the trace took. No limit by default.",
        },
      ],
      examples: [
        {
          title: "Why a node is cut off",
          code: `const zone = network.trace("J1", { stopAt: [] });
for (const stop of zone.stoppedAt) console.log(stop.asset.label, stop.reason, "from", stop.from.label);`,
        },
        {
          title: "The area fed through small pipes, stopping at mains",
          code: `const area = network.trace("J1", {
  stopAt: ["tanks", "reservoirs", "pumps", "controlValves", (asset) => asset.type === "pipe" && asset.diameter >= 300],
});
selection.set(area.nodes);`,
        },
        {
          title:
            "Everything connected on the drawing, stopping only at closed links",
          code: `const piece = network.trace("J1", { mode: "connected", stopAt: ["closed"] });
console.log(piece.nodes.length, "nodes;", piece.stoppedAt.length, "closed links on the rim");`,
        },
        {
          title: "Everything within 500 along the pipes",
          code: `const near = network.trace("J1", { stopAt: [], maxDistance: 500 });
console.table(near.nodes.map((node) => ({ node: node.label, distance: near.distance(node) })));`,
        },
      ],
      throws: [
        '`network.trace found no asset labelled "X"`',
        '`network.trace has no option "X"; it takes mode, stopAt, maxDistance and maxHops`',
        "`network.trace expects stopAt functions to return true or false`",
        "`network.trace expects maxDistance as a number of at least 0, in the project length unit`",
        "`network.trace expects maxHops as a whole number of at least 0`",
      ],
    }),
    network({
      name: "boundaryLinks",
      signature: "boundaryLinks(nodes: (NodeAsset | string)[]): BoundaryLink[]",
      summary:
        "The rim of any set of nodes: every link with exactly one end inside.",
    }),
    network({
      name: "shortestPath",
      signature:
        'shortestPath(from: NodeAsset | string, to: NodeAsset | string, options?: { weightBy?: "length" | ((link: LinkAsset) => number) }): Path | null',
      summary:
        "The cheapest path between two nodes, or `null` when they are not connected.",
      params: [
        {
          name: "options.weightBy",
          description:
            '`"length"`, the default (pipe lengths; pumps and valves cost 0), or a function returning a cost of at least 0.',
        },
      ],
    }),
    memberOf("Valve")({
      name: "targetNodeOptions",
      signature: "targetNodeOptions(): NodeAsset[]",
      summary:
        "For a PRV, the nodes the asset panel offers as its remote set-point target (downstream of the valve); `[]` for any other kind.",
    }),
  ],
  notes:
    "Do not hand-roll a breadth-first search — `trace`, `boundaryLinks` and `shortestPath` cover it. To change where a trace stops, give it `stopAt`, `maxDistance` or `maxHops`; to learn why it stopped, read `stoppedAt`; for how far a node is along the pipes, `distance(node)`.",
};
