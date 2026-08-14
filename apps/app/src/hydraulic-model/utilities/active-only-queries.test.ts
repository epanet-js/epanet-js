import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ActiveAssetIndex, ActiveTopology } from "./active-only-queries";

const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;

// J1 -P1- J2 -P2(disabled)- J3(disabled)
const buildModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1)
    .aJunction(IDS.J2)
    .aJunction(IDS.J3, { isActive: false })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .aPipe(IDS.P2, {
      startNodeId: IDS.J2,
      endNodeId: IDS.J3,
      isActive: false,
    })
    .build();

describe("ActiveAssetIndex", () => {
  const buildIndex = () => {
    const model = buildModel();
    return new ActiveAssetIndex(model.assetIndex, model.assets);
  };

  it("counts only active assets", () => {
    const index = buildIndex();

    expect(index.linkCount).toBe(1);
    expect(index.nodeCount).toBe(2);
  });

  it("hides inactive assets", () => {
    const index = buildIndex();

    expect(index.hasLink(IDS.P2)).toBe(false);
    expect(index.hasNode(IDS.J3)).toBe(false);
    expect(index.getLinkIndex(IDS.P2)).toBeNull();
    expect(index.getNodeIndex(IDS.J3)).toBeNull();
    expect(index.getLinkType(IDS.P2)).toBeUndefined();
    expect(index.getNodeType(IDS.J3)).toBeUndefined();
  });

  it("iterates active assets with dense ascending indices", () => {
    const index = buildIndex();

    expect([...index.iterateLinks()]).toEqual([[IDS.P1, 0]]);
    expect([...index.iterateNodes()]).toEqual([
      [IDS.J1, 0],
      [IDS.J2, 1],
    ]);
  });

  it("resolves ids and indices consistently in both directions", () => {
    const index = buildIndex();

    expect(index.getNodeId(index.getNodeIndex(IDS.J2)!)).toBe(IDS.J2);
    expect(index.getLinkId(index.getLinkIndex(IDS.P1)!)).toBe(IDS.P1);
  });

  it("renumbers around an inactive asset that comes first", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { isActive: false })
      .aJunction(IDS.J2)
      .build();

    const index = new ActiveAssetIndex(model.assetIndex, model.assets);

    expect([...index.iterateNodes()]).toEqual([[IDS.J2, 0]]);
  });

  it("keeps the underlying maxAssetId so id-addressed buffers stay sized", () => {
    const model = buildModel();

    const index = new ActiveAssetIndex(model.assetIndex, model.assets);

    expect(index.maxAssetId).toBe(model.assetIndex.maxAssetId);
  });
});

describe("ActiveTopology", () => {
  const buildTopology = () => {
    const model = buildModel();
    return new ActiveTopology(model.topology, model.assets);
  };

  it("excludes inactive links from connections", () => {
    const topology = buildTopology();

    expect(topology.getLinks(IDS.J2)).toEqual([IDS.P1]);
  });

  it("returns no connections for an inactive node", () => {
    const topology = buildTopology();

    expect(topology.getLinks(IDS.J3)).toEqual([]);
  });

  it("hides inactive assets", () => {
    const topology = buildTopology();

    expect(topology.hasLink(IDS.P2)).toBe(false);
    expect(topology.hasNode(IDS.J3)).toBe(false);
    expect(topology.hasLink(IDS.P1)).toBe(true);
    expect(topology.hasNode(IDS.J1)).toBe(true);
  });

  it("keeps the endpoints of an active link", () => {
    const topology = buildTopology();

    expect(topology.getNodes(IDS.P1)).toEqual([IDS.J1, IDS.J2]);
  });
});
