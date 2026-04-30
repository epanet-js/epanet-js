import { expect, describe, it } from "vitest";
import { Topology } from "./topology";

const IDS = {
  link1: 1,
  link2: 2,
  A: 3,
  B: 4,
  C: 5,
  NotDefined: 10,
} as const;

describe("Topology", () => {
  it("provides links connected to a node", () => {
    const topology = new Topology();

    topology.addLink(IDS.link1, IDS.A, IDS.B);
    topology.addLink(IDS.link2, IDS.B, IDS.C);

    expect(topology.getLinks(IDS.A)).toEqual([IDS.link1]);
    expect(topology.getLinks(IDS.B)).toEqual([IDS.link1, IDS.link2]);
    expect(topology.getLinks(IDS.C)).toEqual([IDS.link2]);
    expect(topology.getNodes(IDS.link1)).toEqual([IDS.A, IDS.B]);
    expect(topology.getNodes(IDS.link2)).toEqual([IDS.B, IDS.C]);

    expect(topology.getLinks(IDS.NotDefined)).toEqual([]);
    expect(topology.getNodes(IDS.NotDefined)).toEqual([0, 0]);
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

  describe("shortestPath", () => {
    const constant = (value: number) => () => value;

    it("returns the path across a single link", () => {
      const topology = new Topology();
      topology.addLink(IDS.link1, IDS.A, IDS.B);

      const path = topology.shortestPath(IDS.A, IDS.B, constant(10));

      expect(path).toEqual({
        nodeIds: [IDS.A, IDS.B],
        linkIds: [IDS.link1],
        totalLength: 10,
      });
    });

    it("returns a multi-hop path with summed weight", () => {
      const topology = new Topology();
      topology.addLink(IDS.link1, IDS.A, IDS.B);
      topology.addLink(IDS.link2, IDS.B, IDS.C);
      const weights = { [IDS.link1]: 3, [IDS.link2]: 4 } as Record<
        number,
        number
      >;

      const path = topology.shortestPath(IDS.A, IDS.C, (id) => weights[id]);

      expect(path).toEqual({
        nodeIds: [IDS.A, IDS.B, IDS.C],
        linkIds: [IDS.link1, IDS.link2],
        totalLength: 7,
      });
    });

    it("picks the route with the smaller total weight", () => {
      const topology = new Topology();
      const detourLink = 6;
      const detourNode = 7;
      topology.addLink(IDS.link1, IDS.A, IDS.B);
      topology.addLink(IDS.link2, IDS.B, IDS.C);
      topology.addLink(detourLink, IDS.A, detourNode);
      topology.addLink(8, detourNode, IDS.C);
      const weights: Record<number, number> = {
        [IDS.link1]: 1,
        [IDS.link2]: 1,
        [detourLink]: 5,
        8: 5,
      };

      const path = topology.shortestPath(IDS.A, IDS.C, (id) => weights[id]);

      expect(path).toEqual({
        nodeIds: [IDS.A, IDS.B, IDS.C],
        linkIds: [IDS.link1, IDS.link2],
        totalLength: 2,
      });
    });

    it("picks the lighter of parallel links between the same nodes", () => {
      const topology = new Topology();
      topology.addLink(IDS.link1, IDS.A, IDS.B);
      topology.addLink(IDS.link2, IDS.A, IDS.B);
      const weights: Record<number, number> = {
        [IDS.link1]: 10,
        [IDS.link2]: 1,
      };

      const path = topology.shortestPath(IDS.A, IDS.B, (id) => weights[id]);

      expect(path).toEqual({
        nodeIds: [IDS.A, IDS.B],
        linkIds: [IDS.link2],
        totalLength: 1,
      });
    });

    it("traverses links regardless of direction", () => {
      const topology = new Topology();
      topology.addLink(IDS.link1, IDS.B, IDS.A);
      topology.addLink(IDS.link2, IDS.C, IDS.B);

      const path = topology.shortestPath(IDS.A, IDS.C, constant(1));

      expect(path).toEqual({
        nodeIds: [IDS.A, IDS.B, IDS.C],
        linkIds: [IDS.link1, IDS.link2],
        totalLength: 2,
      });
    });

    it("returns null when no path connects the nodes", () => {
      const topology = new Topology();
      topology.addLink(IDS.link1, IDS.A, IDS.B);

      const path = topology.shortestPath(IDS.A, IDS.C, constant(1));

      expect(path).toBeNull();
    });

    it("returns null when start equals end", () => {
      const topology = new Topology();
      topology.addLink(IDS.link1, IDS.A, IDS.B);

      const path = topology.shortestPath(IDS.A, IDS.A, constant(1));

      expect(path).toBeNull();
    });
  });
});
