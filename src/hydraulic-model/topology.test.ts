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
    topology.addLink("link2", "B", "C");

    topology.removeNode("B");

    expect(topology.getLinks("B")).toEqual([]);
    expect(topology.getLinks("A")).toEqual([]);
    expect(topology.getLinks("C")).toEqual([]);
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

  it("crashes when trying to add two links with same id", () => {
    const topology = new Topology();

    topology.addLink("link1", "A", "B");

    expect(() => {
      topology.addLink("link1", "A", "B");
    }).toThrow();

    topology.removeNode("A");

    topology.addLink("link1", "A", "B");

    expect(topology.getLinks("A")).toEqual(["link1"]);
  });

  it("can remove a link by link id", () => {
    const topology = new Topology();

    topology.addLink("link1", "A", "B");
    topology.addLink("link2", "A", "B");

    topology.removeLink("link1");
    expect(topology.getLinks("A")).toEqual(["link2"]);

    topology.removeLink("link2");
    expect(topology.getLinks("A")).toEqual([]);

    topology.removeLink("link2");
    expect(topology.getLinks("A")).toEqual([]);
  });
});
