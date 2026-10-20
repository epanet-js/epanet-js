import { memberOf } from "../members";
import type { Member, Section } from "../types";

const network = memberOf("Network");

const collection = (name: string, type: string, what: string): Member =>
  network({
    name,
    signature: `readonly ${name}: ${type}[]`,
    summary: what,
  });

export const SECTION: Section = {
  id: "network-collections",
  number: "1.2",
  title: "Lists and lookup",
  members: [
    collection("junctions", "Junction", "Every junction."),
    collection("reservoirs", "Reservoir", "Every reservoir."),
    collection("tanks", "Tank", "Every tank."),
    collection("pipes", "Pipe", "Every pipe."),
    collection("pumps", "Pump", "Every pump."),
    collection("valves", "Valve", "Every valve."),
    collection("nodes", "NodeAsset", "Every junction, reservoir and tank."),
    collection("links", "LinkAsset", "Every pipe, pump and valve."),
    collection("assets", "Asset", "Every node and link."),
    collection("customerPoints", "CustomerPoint", "Every customer point."),
    network({
      name: "getNode",
      signature: "getNode(label: string): NodeAsset | null",
      summary: "The junction, reservoir or tank with that label, or `null`.",
    }),
    network({
      name: "getLink",
      signature: "getLink(label: string): LinkAsset | null",
      summary: "The pipe, pump or valve with that label, or `null`.",
    }),
    network({
      name: "get",
      signature: "get(label: string): Asset | null",
      summary: "The node or link with that label, or `null`.",
      description:
        "Prefer `getNode` or `getLink`: a node and a link may share a label.",
      throws: [
        '`network.get("X") matches a node and a link; use getNode or getLink` when both exist.',
      ],
    }),
    network({
      name: "getCustomerPoint",
      signature: "getCustomerPoint(label: string): CustomerPoint | null",
      summary: "The customer point with that label, or `null`.",
      description:
        "Customer points are a separate label group: `getNode` and `getLink` never return one.",
    }),
  ],
  notes:
    "Lookups return `null` rather than throwing. The same asset is always the same object: `network.pipes[0] === network.getLink(network.pipes[0].label)`.",
};
