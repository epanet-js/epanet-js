import { expect, describe, it } from "vitest";
import { Topology } from "./topology";
import { nodesShareLink } from "./topology-queries";

describe("nodesShareLink", () => {
  it("returns true when nodes share a link", () => {
    const topology = new Topology();

    topology.addLink("P1", "J1", "J2");

    expect(nodesShareLink(topology, "J1", "J2")).toBe(true);
  });

  it("returns true when nodes share multiple links", () => {
    const topology = new Topology();

    topology.addLink("P1", "J1", "J2");
    topology.addLink("P2", "J1", "J2");

    expect(nodesShareLink(topology, "J1", "J2")).toBe(true);
  });

  it("returns false when nodes do not share a link", () => {
    const topology = new Topology();

    topology.addLink("P1", "J1", "J2");
    topology.addLink("P2", "J2", "J3");

    expect(nodesShareLink(topology, "J1", "J3")).toBe(false);
  });

  it("returns false when one node has no links", () => {
    const topology = new Topology();

    topology.addLink("P1", "J1", "J2");

    expect(nodesShareLink(topology, "J1", "J3")).toBe(false);
  });

  it("returns false when both nodes have no links", () => {
    const topology = new Topology();

    expect(nodesShareLink(topology, "J1", "J2")).toBe(false);
  });

  it("returns false when nodes share a common neighbor but not a direct link", () => {
    const topology = new Topology();

    topology.addLink("P1", "J1", "J2");
    topology.addLink("P2", "J2", "J3");

    expect(nodesShareLink(topology, "J1", "J3")).toBe(false);
  });
});
