import { expect, describe, it } from "vitest";
import { Topology } from "./topology";

const IDS = {
  link1: 1,
  link2: 2,
  A: 3,
  B: 4,
  C: 5,
} as const;

describe("Topology", () => {
  it("provides links connected to a node", () => {
    const topology = new Topology();

    topology.addLink(IDS.link1, IDS.A, IDS.B);
    topology.addLink(IDS.link2, IDS.B, IDS.C);

    expect(topology.getLinks(IDS.A)).toEqual([IDS.link1]);
    expect(topology.getLinks(IDS.B)).toEqual([IDS.link1, IDS.link2]);
    expect(topology.getLinks(IDS.C)).toEqual([IDS.link2]);
  });

  it("removes links when removing nodes", () => {
    const topology = new Topology();

    topology.addLink(IDS.link1, IDS.A, IDS.B);
    topology.addLink(IDS.link2, IDS.B, IDS.C);

    topology.removeNode(IDS.B);

    expect(topology.getLinks(IDS.B)).toEqual([]);
    expect(topology.getLinks(IDS.A)).toEqual([]);
    expect(topology.getLinks(IDS.C)).toEqual([]);
  });

  it("does not crash when removing missing node", () => {
    const topology = new Topology();

    topology.addLink(IDS.link1, IDS.A, IDS.B);

    topology.removeNode(IDS.C);

    expect(topology.getLinks(IDS.A)).toEqual([IDS.link1]);
  });

  it("allows two links with same start and end", () => {
    const topology = new Topology();

    topology.addLink(IDS.link1, IDS.A, IDS.B);
    topology.addLink(IDS.link2, IDS.A, IDS.B);

    expect(topology.getLinks(IDS.A)).toEqual([IDS.link1, IDS.link2]);
  });

  it("skipswhen trying to add two links with same id", () => {
    const topology = new Topology();

    topology.addLink(IDS.link1, IDS.A, IDS.B);

    topology.removeNode(IDS.A);

    topology.addLink(IDS.link1, IDS.A, IDS.B);

    expect(topology.getLinks(IDS.A)).toEqual([IDS.link1]);
  });

  it("can remove a link by link id", () => {
    const topology = new Topology();

    topology.addLink(IDS.link1, IDS.A, IDS.B);
    topology.addLink(IDS.link2, IDS.A, IDS.B);

    topology.removeLink(IDS.link1);
    expect(topology.getLinks(IDS.A)).toEqual([IDS.link2]);

    topology.removeLink(IDS.link2);
    expect(topology.getLinks(IDS.A)).toEqual([]);

    topology.removeLink(IDS.link2);
    expect(topology.getLinks(IDS.A)).toEqual([]);
  });
});
