import { describe, it, expect, vi } from "vitest";
import { AssetIndex } from "./asset-index";
import { AssetIndexEncoder, AssetIndexView } from "./asset-index-transferable";
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

    const assets = createAssetsMap(
      [IDS.P1, IDS.P2, IDS.P3],
      [IDS.J1, IDS.J2, IDS.J3],
    );
    const assetIndex = new AssetIndex(idGenerator, assets);
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
    const assetIndex = new AssetIndex(new ConsecutiveIdsGenerator(), new Map());
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

    const assets = createAssetsMap([IDS.P1, IDS.P2, IDS.P3], [IDS.J1, IDS.J2]);
    const assetIndex = new AssetIndex(idGenerator, assets);
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
    const assets = createAssetsMap([5, 6], [10, 8]);
    const assetIndex = new AssetIndex(idGenerator, assets);
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
    const assets = createAssetsMap([5], [10]);
    const assetIndex = new AssetIndex(idGenerator, assets);
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
    const assets = createAssetsMap([5], [10]);
    const assetIndex = new AssetIndex(idGenerator, assets);
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

  it("IDs query methods return correct values", () => {
    const idGenerator = new ConsecutiveIdsGenerator();
    vi.spyOn(idGenerator, "totalGenerated", "get").mockReturnValue(200);
    const assets = createAssetsMap([100, 200], [5, 150]);
    const assetIndex = new AssetIndex(idGenerator, assets);
    assetIndex.addLink(100);
    assetIndex.addNode(5);
    assetIndex.addLink(200);
    assetIndex.addNode(150);

    const view = new AssetIndexView(new AssetIndexEncoder(assetIndex).encode());

    expect(view.getLinkId(0)).toBe(100);
    expect(view.getLinkId(1)).toBe(200);
    expect(view.getNodeId(0)).toBe(5);
    expect(view.getNodeId(1)).toBe(150);
    // out of bounds
    expect(view.getNodeId(-1)).toBeNull();
    expect(view.getNodeId(10)).toBeNull();
    expect(view.getLinkId(-1)).toBeNull();
    expect(view.getLinkId(10)).toBeNull();
  });
});
