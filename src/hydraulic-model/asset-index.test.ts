import { describe, it, expect } from "vitest";
import { AssetIndex, AssetIndexView } from "./asset-index";

describe("AssetIndex - Basics", () => {
  it("tracks separate counts for links and nodes", () => {
    const assetIndex = new AssetIndex();
    assetIndex.addLink(1);
    assetIndex.addNode(2);
    assetIndex.addNode(4);

    expect(assetIndex.linkCount).toBe(1);
    expect(assetIndex.nodeCount).toBe(2);
  });

  it("iterates internalIds in buffer order", () => {
    const assetIndex = new AssetIndex();
    assetIndex.addLink(100);
    assetIndex.addLink(5);
    assetIndex.addNode(20);
    assetIndex.addNode(10);

    expect(Array.from(assetIndex.iterateLinkAssetIds())).toEqual([100, 5]);
    expect(Array.from(assetIndex.iterateNodeAssetIds())).toEqual([20, 10]);
  });
});

describe("AssetIndexView - Iterators", () => {
  it("iterates link and node internal IDs separately", () => {
    const IDS = {
      P1: 1,
      P2: 3,
      P3: 5,
      J1: 2,
      J2: 4,
      J3: 10,
    } as const;

    const assetIndex = new AssetIndex();
    assetIndex.addLink(IDS.P1);
    assetIndex.addNode(IDS.J1);
    assetIndex.addLink(IDS.P2);
    assetIndex.addNode(IDS.J2);
    assetIndex.addLink(IDS.P3);
    assetIndex.addNode(IDS.J3);

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    expect(Array.from(view.iterateLinks())).toEqual([
      [IDS.P1, 0],
      [IDS.P2, 1],
      [IDS.P3, 2],
    ]);
    expect(Array.from(view.iterateNodes())).toEqual([
      [IDS.J1, 0],
      [IDS.J2, 1],
      [IDS.J3, 2],
    ]);
  });

  it("iterates empty AssetIndex", () => {
    const assetIndex = new AssetIndex();

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    expect(Array.from(view.iterateLinks())).toEqual([]);
    expect(Array.from(view.iterateNodes())).toEqual([]);
  });

  it("iterates only actual assets with sparse IDs", () => {
    const IDS = {
      P1: 100,
      P2: 200,
      J1: 5,
      J2: 150,
    } as const;

    const assetIndex = new AssetIndex();
    assetIndex.addLink(IDS.P1);
    assetIndex.addNode(IDS.J1);
    assetIndex.addLink(IDS.P2);
    assetIndex.addNode(IDS.J2);

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    const links = Array.from(view.iterateLinks());
    const nodes = Array.from(view.iterateNodes());

    expect(links).toEqual([
      [IDS.P1, 0],
      [IDS.P2, 1],
    ]);
    expect(nodes).toEqual([
      [IDS.J1, 0],
      [IDS.J2, 1],
    ]);
    expect(links.length).toBe(2);
    expect(nodes.length).toBe(2);
  });

  it("provides link and node counts from encoded buffer", () => {
    const IDS = {
      P1: 1,
      P2: 3,
      P3: 5,
      J1: 2,
      J2: 4,
    } as const;

    const assetIndex = new AssetIndex();
    assetIndex.addLink(IDS.P1);
    assetIndex.addLink(IDS.P2);
    assetIndex.addLink(IDS.P3);
    assetIndex.addNode(IDS.J1);
    assetIndex.addNode(IDS.J2);

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    expect(view.linkCount).toBe(3);
    expect(view.nodeCount).toBe(2);
  });

  it("provides zero counts for empty AssetIndex", () => {
    const assetIndex = new AssetIndex();

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    expect(view.linkCount).toBe(0);
    expect(view.nodeCount).toBe(0);
  });
});

describe("AssetIndexView - Queries", () => {
  it("returns null when querying wrong type or out of bounds", () => {
    const assetIndex = new AssetIndex();
    assetIndex.addLink(5);
    assetIndex.addNode(10);

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    expect(view.getNodeIndex(5)).toBeNull();
    expect(view.getLinkIndex(10)).toBeNull();
    expect(view.getLinkIndex(100)).toBeNull();
    expect(view.getNodeIndex(100)).toBeNull();
    expect(view.getLinkIndex(-1)).toBeNull();
  });

  it("has methods return false for wrong type or missing assets", () => {
    const assetIndex = new AssetIndex();
    assetIndex.addLink(5);
    assetIndex.addNode(10);

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    expect(view.hasNode(5)).toBe(false);
    expect(view.hasLink(10)).toBe(false);
    expect(view.hasLink(100)).toBe(false);
    expect(view.hasNode(100)).toBe(false);
    expect(view.hasLink(-1)).toBe(false);
    expect(view.hasLink(0)).toBe(false);
    expect(view.hasNode(0)).toBe(false);
  });
});

describe("Roundtrip Tests", () => {
  it("sparse internalIds with large gaps", () => {
    const assetIndex = new AssetIndex();
    assetIndex.addLink(100);
    assetIndex.addNode(5);
    assetIndex.addLink(200);

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    expect(view.count).toBe(201);
    expect(view.getLinkIndex(100)).toBe(0);
    expect(view.getNodeIndex(5)).toBe(0);
    expect(view.getLinkIndex(200)).toBe(1);

    for (let i = 0; i < 5; i++) {
      expect(view.hasLink(i)).toBe(false);
      expect(view.hasNode(i)).toBe(false);
    }
  });

  it("mixed types interleaved", () => {
    const assetIndex = new AssetIndex();
    assetIndex.addLink(1);
    assetIndex.addNode(2);
    assetIndex.addLink(3);
    assetIndex.addNode(4);
    assetIndex.addLink(5);

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    expect(view.hasLink(1)).toBe(true);
    expect(view.hasNode(2)).toBe(true);
    expect(view.hasLink(3)).toBe(true);
    expect(view.hasNode(4)).toBe(true);
    expect(view.hasLink(5)).toBe(true);

    expect(view.getLinkIndex(1)).toBe(0);
    expect(view.getNodeIndex(2)).toBe(0);
    expect(view.getLinkIndex(3)).toBe(1);
    expect(view.getNodeIndex(4)).toBe(1);
    expect(view.getLinkIndex(5)).toBe(2);
  });

  it("verifies all buffer positions match", () => {
    const assetIndex = new AssetIndex();
    const linkIds = [5, 10, 15, 20, 25];
    const nodeIds = [3, 7, 11, 13];

    linkIds.forEach((id) => assetIndex.addLink(id));
    nodeIds.forEach((id) => assetIndex.addNode(id));

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    linkIds.forEach((internalId, expectedBufferIndex) => {
      expect(view.getLinkIndex(internalId)).toBe(expectedBufferIndex);
    });

    nodeIds.forEach((internalId, expectedBufferIndex) => {
      expect(view.getNodeIndex(internalId)).toBe(expectedBufferIndex);
    });
  });
});

describe("Edge Cases", () => {
  it("empty AssetIndex", () => {
    const assetIndex = new AssetIndex();

    expect(assetIndex.linkCount).toBe(0);
    expect(assetIndex.nodeCount).toBe(0);
    expect(Array.from(assetIndex.iterateLinkAssetIds())).toEqual([]);
    expect(Array.from(assetIndex.iterateNodeAssetIds())).toEqual([]);

    const encoder = assetIndex.getEncoder("array");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    const view = new AssetIndexView(buffer);

    expect(view.count).toBe(0);
  });

  it("shared buffer type support", () => {
    const assetIndex = new AssetIndex();
    assetIndex.addLink(5);

    const encoder = assetIndex.getEncoder("shared");
    const buffer = encoder.encode(
      () => assetIndex.iterateLinkAssetIds(),
      () => assetIndex.iterateNodeAssetIds(),
    );
    expect(buffer).toBeInstanceOf(SharedArrayBuffer);

    const view = new AssetIndexView(buffer);
    expect(view.getLinkIndex(5)).toBe(0);
  });
});
