import { expect, describe, it } from "vitest";
import { Topology } from "./topology";

describe("Topology", () => {
  it("provides links connected to a node", () => {
    const topology = new Topology();

    topology.addLink("link1", "A", "B");
    topology.addLink("link2", "B", "C");

    expect(topology.getLinks("A")).toEqual(["link1"]);
    expect(topology.getLinks("B")).toEqual(["link1", "link2"]);
    expect(topology.getLinks("C")).toEqual(["link2"]);
  });

  it("removes links when removing nodes", () => {
    const topology = new Topology();

    topology.addLink("link1", "A", "B");

    topology.removeNode("A");

    expect(topology.getLinks("B")).toEqual([]);
    expect(topology.getLinks("A")).toEqual([]);
  });

  it("does not crash when removing missing node", () => {
    const topology = new Topology();

    topology.addLink("link1", "A", "B");

    topology.removeNode("C");

    expect(topology.getLinks("A")).toEqual(["link1"]);
  });

  it("allows two links with same start and end", () => {
    const topology = new Topology();

    topology.addLink("link1", "A", "B");
    topology.addLink("link2", "A", "B");

    expect(topology.getLinks("A")).toEqual(["link1", "link2"]);
  });
});
