import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildOrphanAssets, encodeData } from "./data";
import { AssetIndexView } from "src/hydraulic-model/asset-index";
import { TopologyView } from "src/hydraulic-model/topology/topologyView";

describe("buildOrphanAssets", () => {
  it("returns results sorted by type and asset label", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      PM1: 3,
      PM2: 4,
      V1: 5,
      V2: 6,
      T1: 7,
      T2: 8,
      R1: 9,
      R2: 10,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J2, { label: "J2" })
      .aJunction(IDS.J1, { label: "J1" })
      .aPump(IDS.PM2, { label: "PM2" })
      .aPump(IDS.PM1, { label: "PM1" })
      .aValve(IDS.V2, { label: "V2" })
      .aValve(IDS.V1, { label: "V1" })
      .aTank(IDS.T2, { label: "T2" })
      .aTank(IDS.T1, { label: "T1" })
      .aReservoir(IDS.R2, { label: "R2" })
      .aReservoir(IDS.R1, { label: "R1" })
      .build();

    const rawOrphanAssets = {
      orphanNodes: [IDS.J1, IDS.J2, IDS.T1, IDS.T2, IDS.R1, IDS.R2],
      orphanLinks: [IDS.PM1, IDS.PM2, IDS.V1, IDS.V2],
    };

    const orphanAssets = buildOrphanAssets(model, rawOrphanAssets);

    expect(orphanAssets.map((asset) => asset.label)).toEqual([
      "R1",
      "R2",
      "T1",
      "T2",
      "V1",
      "V2",
      "PM1",
      "PM2",
      "J1",
      "J2",
    ]);
  });
});

describe("encodeData", () => {
  it("encodes asset index", () => {
    const IDS = { J1: 1, T1: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aTank(IDS.T1, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.T1 })
      .build();

    const data = encodeData(model);
    const assetIndexView = new AssetIndexView(data.assetIndexBuffers);

    expect(assetIndexView.nodeCount).toBe(model.assetIndex.nodeCount);
    expect(assetIndexView.linkCount).toBe(model.assetIndex.linkCount);
    expect(assetIndexView.hasNode(IDS.J1)).toBe(
      model.assetIndex.hasNode(IDS.J1),
    );
    expect(assetIndexView.hasNode(IDS.T1)).toBe(
      model.assetIndex.hasNode(IDS.T1),
    );
    expect(assetIndexView.hasLink(IDS.P1)).toBe(assetIndexView.hasLink(IDS.P1));
  });

  it("encodes asset types", () => {
    const IDS = { J1: 1, T1: 2, R1: 3, P1: 4, V1: 5, PM1: 6 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aTank(IDS.T1, { coordinates: [10, 0] })
      .aReservoir(IDS.R1, { coordinates: [20, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.T1 })
      .aValve(IDS.V1, { startNodeId: IDS.T1, endNodeId: IDS.R1 })
      .aPump(IDS.PM1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const data = encodeData(model);
    const assetIndexView = new AssetIndexView(data.assetIndexBuffers);

    expect(assetIndexView.getNodeType(IDS.J1)).toBe(
      model.assetIndex.getNodeType(IDS.J1),
    );
    expect(assetIndexView.getNodeType(IDS.T1)).toBe(
      model.assetIndex.getNodeType(IDS.T1),
    );
    expect(assetIndexView.getNodeType(IDS.R1)).toBe(
      model.assetIndex.getNodeType(IDS.R1),
    );
    expect(assetIndexView.getLinkType(IDS.P1)).toBe(
      model.assetIndex.getLinkType(IDS.P1),
    );
    expect(assetIndexView.getLinkType(IDS.V1)).toBe(
      model.assetIndex.getLinkType(IDS.V1),
    );
    expect(assetIndexView.getLinkType(IDS.PM1)).toBe(
      model.assetIndex.getLinkType(IDS.PM1),
    );
  });

  it("encodes topology", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aJunction(IDS.J3, { coordinates: [20, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const data = encodeData(model);
    const topologyView = new TopologyView(
      data.topologyBuffers,
      new AssetIndexView(data.assetIndexBuffers),
    );

    expect(topologyView.getLinks(IDS.J1)).toEqual(
      model.topology.getLinks(IDS.J1),
    );
    expect(topologyView.getLinks(IDS.J2)).toEqual(
      model.topology.getLinks(IDS.J2),
    );
    expect(topologyView.getLinks(IDS.J3)).toEqual(
      model.topology.getLinks(IDS.J3),
    );
  });
});
