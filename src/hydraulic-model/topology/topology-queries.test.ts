import { expect, describe, it } from "vitest";
import { Topology } from "./topology";
import { nodesShareLink } from "./topology-queries";

const IDS = {
  P1: 1,
  P2: 2,
  J1: 3,
  J2: 4,
  J3: 5,
} as const;

describe("nodesShareLink", () => {
  it("returns true when nodes share a link", () => {
    const topology = new Topology();

    topology.addLink(IDS.P1, IDS.J1, IDS.J2);

    expect(nodesShareLink(topology, IDS.J1, IDS.J2)).toBe(true);
  });

  it("returns true when nodes share multiple links", () => {
    const topology = new Topology();

    topology.addLink(IDS.P1, IDS.J1, IDS.J2);
    topology.addLink(IDS.P2, IDS.J1, IDS.J2);

    expect(nodesShareLink(topology, IDS.J1, IDS.J2)).toBe(true);
  });

  it("returns false when nodes do not share a link", () => {
    const topology = new Topology();

    topology.addLink(IDS.P1, IDS.J1, IDS.J2);
    topology.addLink(IDS.P2, IDS.J2, IDS.J3);

    expect(nodesShareLink(topology, IDS.J1, IDS.J3)).toBe(false);
  });

  it("returns false when one node has no links", () => {
    const topology = new Topology();

    topology.addLink(IDS.P1, IDS.J1, IDS.J2);

    expect(nodesShareLink(topology, IDS.J1, IDS.J3)).toBe(false);
  });

  it("returns false when both nodes have no links", () => {
    const topology = new Topology();

    expect(nodesShareLink(topology, IDS.J1, IDS.J2)).toBe(false);
  });

  it("returns false when nodes share a common neighbor but not a direct link", () => {
    const topology = new Topology();

    topology.addLink(IDS.P1, IDS.J1, IDS.J2);
    topology.addLink(IDS.P2, IDS.J2, IDS.J3);

    expect(nodesShareLink(topology, IDS.J1, IDS.J3)).toBe(false);
  });
});
