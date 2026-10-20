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
      name: "TraceResult",
      definition:
        "interface TraceResult { nodes: NodeAsset[]; links: LinkAsset[]; boundaryLinks: BoundaryLink[] }",
      summary: "The zone a trace reached and the links on its rim.",
    },
    {
      name: "Path",
      definition:
        "interface Path { nodes: NodeAsset[]; links: LinkAsset[]; totalLength: number }",
      summary: "A path between two nodes.",
    },
  ],
  members: [
    network({
      name: "trace",
      signature:
        'trace(start: Asset | string | (Asset | string)[], options?: { mode?: "allowed" }): TraceResult',
      summary:
        "The app's Trace tool, boundary mode: the pressure zone around `start`.",
      description:
        "It grows through open links and stops at reservoirs and tanks (not included), pumps, closed links and every valve except TCVs.",
      params: [
        {
          name: "options.mode",
          description:
            '`"allowed"`, the default. `"upstream"` and `"downstream"` need simulation results and throw.',
        },
      ],
      throws: ['`network.trace found no asset labelled "X"`'],
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
    "Do not hand-roll a breadth-first search — `trace`, `boundaryLinks` and `shortestPath` cover it.",
};
