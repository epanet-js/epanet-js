import { describe, it, expect } from "vitest";
import { AssetIndex, AssetIndexEncoder, AssetIndexView } from "./asset-index";
import { ConsecutiveIdsGenerator } from "./id-generator";

describe("AssetIndex - Basics", () => {
  it("tracks separate counts for links and nodes", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    assetIndex.addLink(1);
    assetIndex.addNode(2);
    assetIndex.addNode(4);

    expect(assetIndex.linkCount).toBe(1);
    expect(assetIndex.nodeCount).toBe(2);
  });

  it("iterating returns internalIds and link/node indexes in insertion order", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    assetIndex.addLink(100);
    assetIndex.addNode(20);
    assetIndex.addLink(5);
    assetIndex.addNode(10);

    expect(Array.from(assetIndex.iterateLinks())).toEqual([
      [100, 0],
      [5, 1],
    ]);
    expect(Array.from(assetIndex.iterateNodes())).toEqual([
      [20, 0],
      [10, 1],
    ]);
  });
});

describe("AssetIndex - Removal and Re-addition", () => {
  it("removing a link updates count and iterator", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    assetIndex.addLink(1);
    assetIndex.addLink(2);
    expect(assetIndex.linkCount).toBe(2);
    expect(assetIndex.hasLink(1)).toBe(true);
    expect(Array.from(assetIndex.iterateLinks())).toEqual([
      [1, 0],
      [2, 1],
    ]);

    assetIndex.removeLink(1);
    expect(assetIndex.linkCount).toBe(1);
    expect(assetIndex.hasLink(1)).toBe(false);
    expect(Array.from(assetIndex.iterateLinks())).toEqual([[2, 0]]);
  });

  it("removing a link updates count and iterator", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    assetIndex.addNode(1);
    assetIndex.addNode(2);
    expect(assetIndex.nodeCount).toBe(2);
    expect(assetIndex.hasNode(1)).toBe(true);
    expect(Array.from(assetIndex.iterateNodes())).toEqual([
      [1, 0],
      [2, 1],
    ]);

    assetIndex.removeNode(1);
    expect(assetIndex.nodeCount).toBe(1);
    expect(assetIndex.hasNode(1)).toBe(false);
    expect(Array.from(assetIndex.iterateNodes())).toEqual([[2, 0]]);
  });

  it("re-adding a removed ID changes its position in the iteration", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    assetIndex.addLink(5);
    assetIndex.addLink(10);
    const originalIteration = Array.from(assetIndex.iterateLinks());

    assetIndex.removeLink(5);
    expect(assetIndex.hasLink(5)).toBe(false);
    assetIndex.addLink(5);
    expect(assetIndex.hasLink(5)).toBe(true);
    const newIteration = Array.from(assetIndex.iterateLinks());

    expect(originalIteration.length).toEqual(newIteration.length);
    expect(newIteration).not.toEqual(expect.arrayContaining(originalIteration));
  });

  it("handles removing non-existent ID gracefully", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    assetIndex.removeLink(999);
    assetIndex.removeNode(888);
    expect(assetIndex.linkCount).toBe(0);
  });

  it("prevents duplicate additions", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    assetIndex.addLink(5);
    assetIndex.addLink(5);
    expect(assetIndex.linkCount).toBe(1);
    expect(Array.from(assetIndex.iterateLinks())).toEqual([[5, 0]]);
  });

  it("replaces link ID when adding same ID as node", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    assetIndex.addLink(10);
    expect(assetIndex.linkCount).toBe(1);
    expect(assetIndex.nodeCount).toBe(0);

    assetIndex.addNode(10);
    expect(assetIndex.linkCount).toBe(0);
    expect(assetIndex.nodeCount).toBe(1);
  });

  it("replaces node ID when adding same ID as link", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    assetIndex.addNode(10);
    expect(assetIndex.linkCount).toBe(0);
    expect(assetIndex.nodeCount).toBe(1);

    assetIndex.addLink(10);
    expect(assetIndex.linkCount).toBe(1);
    expect(assetIndex.nodeCount).toBe(0);
  });
});

describe("AssetIndexView - Iterators and count", () => {
  it("iterates link and node internal IDs separately", () => {
    const idGenerator = new ConsecutiveIdsGenerator();
    const IDS = {
      P1: idGenerator.newId(),
      P2: idGenerator.newId(),
      P3: idGenerator.newId(),
      J1: idGenerator.newId(),
      J2: idGenerator.newId(),
      J3: idGenerator.newId(),
    } as const;

    const assetIndex = new AssetIndex(idGenerator);
    assetIndex.addLink(IDS.P1);
    assetIndex.addNode(IDS.J1);
    assetIndex.addLink(IDS.P3);
    assetIndex.addNode(IDS.J3);
    assetIndex.addLink(IDS.P2);
    assetIndex.addNode(IDS.J2);

    const encodedBuffer = new AssetIndexEncoder(assetIndex).encode();
    const view = new AssetIndexView(encodedBuffer);

    expect(Array.from(view.iterateLinks())).toEqual([
      [IDS.P1, 0],
      [IDS.P2, 2],
      [IDS.P3, 1],
    ]);
    expect(Array.from(view.iterateNodes())).toEqual([
      [IDS.J1, 0],
      [IDS.J2, 2],
      [IDS.J3, 1],
    ]);
  });

  it("with empty AssetIndex", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator());
    const view = new AssetIndexView(new AssetIndexEncoder(assetIndex).encode());

    expect(Array.from(view.iterateLinks())).toEqual([]);
    expect(Array.from(view.iterateNodes())).toEqual([]);

    expect(view.linkCount).toBe(0);
    expect(view.nodeCount).toBe(0);
  });

  it("with sparse IDs (with gaps)", () => {
    const idGenerator = new ConsecutiveIdsGenerator();
    vi.spyOn(idGenerator, "totalGenerated", "get").mockReturnValue(200);
    const IDS = {
      P1: 100,
      P2: 200,
      P3: 10,
      J1: 5,
      J2: 150,
    } as const;

    const assetIndex = new AssetIndex(idGenerator);
    assetIndex.addLink(IDS.P1);
    assetIndex.addNode(IDS.J1);
    assetIndex.addLink(IDS.P2);
    assetIndex.addNode(IDS.J2);
    assetIndex.addLink(IDS.P3);

    const view = new AssetIndexView(new AssetIndexEncoder(assetIndex).encode());

    const links = Array.from(view.iterateLinks());
    const nodes = Array.from(view.iterateNodes());

    expect(links).toEqual([
      [IDS.P3, 2],
      [IDS.P1, 0],
      [IDS.P2, 1],
    ]);
    expect(nodes).toEqual([
      [IDS.J1, 0],
      [IDS.J2, 1],
    ]);
    expect(view.linkCount).toBe(3);
    expect(view.nodeCount).toBe(2);
  });
});

describe("AssetIndexView - Queries", () => {
  it("index query methods return correct buffer position", () => {
    const idGenerator = new ConsecutiveIdsGenerator();
    vi.spyOn(idGenerator, "totalGenerated", "get").mockReturnValue(10);
    const assetIndex = new AssetIndex(idGenerator);
    assetIndex.addLink(5);
    assetIndex.addNode(10);
    assetIndex.addLink(6);
    assetIndex.addNode(8);

    const links = Array.from(assetIndex.iterateLinks());
    const nodes = Array.from(assetIndex.iterateNodes());

    const view = new AssetIndexView(new AssetIndexEncoder(assetIndex).encode());

    const viewLinks = Array.from(view.iterateLinks());
    const viewNodes = Array.from(view.iterateNodes());

    expect(viewLinks).toEqual(expect.arrayContaining(links));
    expect(viewNodes).toEqual(expect.arrayContaining(nodes));
  });

  it("index query methods return null for wrong type or out of bounds", () => {
    const idGenerator = new ConsecutiveIdsGenerator();
    vi.spyOn(idGenerator, "totalGenerated", "get").mockReturnValue(10);
    const assetIndex = new AssetIndex(idGenerator);
    assetIndex.addLink(5);
    assetIndex.addNode(10);

    const view = new AssetIndexView(new AssetIndexEncoder(assetIndex).encode());

    expect(view.getNodeIndex(5)).toBeNull();
    expect(view.getLinkIndex(10)).toBeNull();
    expect(view.getLinkIndex(100)).toBeNull();
    expect(view.getNodeIndex(100)).toBeNull();
    expect(view.getLinkIndex(-1)).toBeNull();
  });

  it("has methods return false for wrong type or missing assets", () => {
    const idGenerator = new ConsecutiveIdsGenerator();
    vi.spyOn(idGenerator, "totalGenerated", "get").mockReturnValue(10);
    const assetIndex = new AssetIndex(idGenerator);
    assetIndex.addLink(5);
    assetIndex.addNode(10);

    const view = new AssetIndexView(new AssetIndexEncoder(assetIndex).encode());

    expect(view.hasNode(5)).toBe(false);
    expect(view.hasLink(10)).toBe(false);
    expect(view.hasLink(100)).toBe(false);
    expect(view.hasNode(100)).toBe(false);
    expect(view.hasLink(-1)).toBe(false);
    expect(view.hasLink(0)).toBe(false);
    expect(view.hasNode(0)).toBe(false);
  });
});
