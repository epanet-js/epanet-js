import { memberOf } from "../members";
import type { Section } from "../types";

const network = memberOf("Network");

export const SECTION: Section = {
  id: "review",
  number: "1.7",
  title: "Network review and validation",
  intro:
    "These are the app's own checks — a script gets exactly what the Network Review panel and the Run button get. They run on the active network only (inactive assets are left out).",
  types: [
    {
      name: "ValidationReport",
      definition: `interface ValidationReport {
  status: "ok" | "warning" | "error";
  checks: ("orphanAssets" | "connectivityTrace" | "modelAttributesValidation")[];
  counts: { findings: number; errors: number; warnings: number; assets: number };
  findings: Finding[];
}`,
      summary: "What `network.validate()` found.",
      description:
        '`status` is `"ok"` when there are no findings and Run goes straight through, `"warning"` when there are only warnings, and `"error"` when there is at least one error. Run opens its review dialog for both `"warning"` and `"error"`.',
    },
    {
      name: "Finding",
      definition: `interface Finding {
  check: "orphanAssets" | "connectivityTrace" | "modelAttributesValidation";
  code: string;
  severity: "error" | "warning";
  entityType: string | null;
  field: string | null;
  assets: (Asset | CustomerPoint)[];
  details: { nodes: NodeAsset[]; links: LinkAsset[] } | null;
}`,
      summary: "One rule and everything that failed it.",
      description: `- \`code\` — the app's stable rule id: \`"asset.connected"\`, \`"subNetwork.supplySource.present"\`, or an attribute rule such as \`"pipe.diameter.present"\`, \`"node.elevation.present"\`, \`"pipe.material.inLibrary"\`, \`"customerPoint.connected"\`.
- \`entityType\` — what the rule is about (\`"pipe"\`, \`"tank"\`, \`"customerPoint"\`, …); \`null\` for the topology checks and for rules shared across types (\`node.elevation.present\` covers junctions and tanks — read each asset's \`type\`).
- \`field\` — the property the rule judges, or \`null\`.
- \`details\` — the nodes and links of an unsupplied area, else \`null\`.`,
    },
    {
      name: "Subnetwork",
      definition: `interface Subnetwork {
  nodes: NodeAsset[];
  links: LinkAsset[];
  supplySourceCount: number;
  pipeCount: number;
  bounds: BBox;
}`,
      summary:
        "A connected part of the network. One with `supplySourceCount === 0` has no reservoir or tank.",
    },
    {
      name: "ProximityAnomaly",
      definition:
        "interface ProximityAnomaly { node: NodeAsset; pipe: Pipe; distance: number; nearestPointOnPipe: Position }",
      summary: "A node close to a pipe it is not connected to.",
    },
    {
      name: "CrossingPipe",
      definition:
        "interface CrossingPipe { pipe1: Pipe; pipe2: Pipe; intersectionPoint: Position }",
      summary:
        "Two pipes that cross with no junction where they meet. The smaller pipe is `pipe1`.",
    },
  ],
  members: [
    network({
      name: "validate",
      signature: "validate(): ValidationReport",
      summary: "The checks behind the dialog that opens when you press Run.",
      description:
        "The findings are orphan assets first, then one finding per area with no reservoir or tank, then the attribute rules, errors before warnings. Orphan tanks and reservoirs are not findings: EPANET solves with them. `findOrphanAssets()` still lists them.",
    }),
    network({
      name: "findOrphanAssets",
      signature: "findOrphanAssets(): Asset[]",
      summary:
        "The orphan check: nodes with no links, links missing an end, and pumps or valves with nothing else connected at either end.",
      description: "In the review panel's order: by type, then label.",
    }),
    network({
      name: "findSubnetworks",
      signature: "findSubnetworks(): Subnetwork[]",
      summary:
        "The connectivity check: every connected part of the network, largest first.",
      description: "Parts of a single node are left out (they are orphans).",
    }),
    network({
      name: "findProximityAnomalies",
      signature:
        "findProximityAnomalies(options: { distance: number }): ProximityAnomaly[]",
      summary:
        "The proximity check: nodes within `distance` of a pipe they are not connected to, nearest first.",
      params: [
        {
          name: "options.distance",
          description:
            "In the project length unit. The review panel's default is 0.5 m or 1.5 ft.",
        },
      ],
      throws: [
        "`network.findProximityAnomalies expects { distance } as a number of at least 0, in the project length unit`",
      ],
    }),
    network({
      name: "findCrossingPipes",
      signature: "findCrossingPipes(): CrossingPipe[]",
      summary:
        "The crossing check: pipes that cross on the map with no junction where they meet.",
    }),
  ],
  notes:
    "`findCrossingPipes()` and `findProximityAnomalies()` are informational — never a reason a run fails.",
};
