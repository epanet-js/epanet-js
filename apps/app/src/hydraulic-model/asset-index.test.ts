import { describe, it, expect, vi } from "vitest";
import { AssetIndex } from "./asset-index";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { AssetsMap } from "./assets-map";
import { AssetId } from "@epanet-js/hydraulic-model";
import {
  buildJunction,
  buildPipe,
} from "src/__helpers__/hydraulic-model-builder";

function createAssetsMap(linkIds: AssetId[], nodeIds: AssetId[]): AssetsMap {
  const map: AssetsMap = new Map();
  linkIds.forEach((id) => map.set(id, buildPipe()));
  nodeIds.forEach((id) => map.set(id, buildJunction()));
  return map;
}

describe("AssetIndex - Basics", () => {
  it("tracks separate counts for links and nodes", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
    assetIndex.addLink(1);
    assetIndex.addNode(2);
    assetIndex.addNode(4);

    expect(assetIndex.linkCount).toBe(1);
    expect(assetIndex.nodeCount).toBe(2);
  });

  it("iterating returns internalIds and link/node indexes in insertion order", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
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

  it("getNodeId and getLinkId return correct values", () => {
    const idGenerator = new ConsecutiveIdsGenerator();
    vi.spyOn(idGenerator, "totalGenerated", "get").mockReturnValue(200);
    const assets = createAssetsMap([100, 200], [5, 150]);
    const assetIndex = new AssetIndex(idGenerator, assets);
    assetIndex.addLink(100);
    assetIndex.addNode(5);
    assetIndex.addLink(200);
    assetIndex.addNode(150);

    expect(assetIndex.getLinkId(0)).toBe(100);
    expect(assetIndex.getLinkId(1)).toBe(200);
    expect(assetIndex.getNodeId(0)).toBe(5);
    expect(assetIndex.getNodeId(1)).toBe(150);
    // Out of bounds
    expect(assetIndex.getNodeId(-1)).toBeNull();
    expect(assetIndex.getNodeId(10)).toBeNull();
    expect(assetIndex.getLinkId(-1)).toBeNull();
    expect(assetIndex.getLinkId(10)).toBeNull();
  });
});

describe("AssetIndex - Removal and Re-addition", () => {
  it("removing a link updates count and iterator", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
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
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
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
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
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
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
    assetIndex.removeLink(999);
    assetIndex.removeNode(888);
    expect(assetIndex.linkCount).toBe(0);
  });

  it("prevents duplicate additions", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
    assetIndex.addLink(5);
    assetIndex.addLink(5);
    expect(assetIndex.linkCount).toBe(1);
    expect(Array.from(assetIndex.iterateLinks())).toEqual([[5, 0]]);
  });

  it("replaces link ID when adding same ID as node", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
    assetIndex.addLink(10);
    expect(assetIndex.linkCount).toBe(1);
    expect(assetIndex.nodeCount).toBe(0);

    assetIndex.addNode(10);
    expect(assetIndex.linkCount).toBe(0);
    expect(assetIndex.nodeCount).toBe(1);
  });

  it("replaces node ID when adding same ID as link", () => {
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
    assetIndex.addNode(10);
    expect(assetIndex.linkCount).toBe(0);
    expect(assetIndex.nodeCount).toBe(1);

    assetIndex.addLink(10);
    expect(assetIndex.linkCount).toBe(1);
    expect(assetIndex.nodeCount).toBe(0);
  });
});
