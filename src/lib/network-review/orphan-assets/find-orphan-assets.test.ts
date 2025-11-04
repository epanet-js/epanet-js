import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { findOrphanAssets } from "./find-orphan-assets";
import { AssetTypeQueries } from "src/hydraulic-model/asset-type-queries";

describe("findOrphanAssets", () => {
  it("should find nodes not connected to other assets in the network", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, Orphan: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.Orphan)
      .build();

    const { orphanLinks, orphanNodes } = findOrphanAssets(
      model.topology,
      model.assetIndex,
      new AssetTypeQueries(model.assets),
    );

    expect(orphanNodes).toHaveLength(1);
    expect(orphanLinks).toHaveLength(0);
    expect(orphanNodes[0]).toEqual(IDS.Orphan);
  });

  it("should find valves not connected on both ends to other network pipes", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 3,
      T1: 4,
      NoPipeNode: 5,
      OrphanValve: 6,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aTank(IDS.T1)
      .aJunction(IDS.NoPipeNode)
      .aValve(IDS.OrphanValve, {
        startNodeId: IDS.T1,
        endNodeId: IDS.NoPipeNode,
      })
      .build();

    const { orphanLinks, orphanNodes } = findOrphanAssets(
      model.topology,
      model.assetIndex,
      new AssetTypeQueries(model.assets),
    );

    expect(orphanLinks).toHaveLength(1);
    expect(orphanNodes).toHaveLength(0);
    expect(orphanLinks[0]).toEqual(IDS.OrphanValve);
  });

  it("should find pumps not connected on both ends to other network pipes", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 3,
      T1: 4,
      NoPipeNode: 5,
      OrphanPump: 6,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aTank(IDS.T1)
      .aJunction(IDS.NoPipeNode)
      .aPump(IDS.OrphanPump, {
        startNodeId: IDS.T1,
        endNodeId: IDS.NoPipeNode,
      })
      .build();

    const { orphanLinks, orphanNodes } = findOrphanAssets(
      model.topology,
      model.assetIndex,
      new AssetTypeQueries(model.assets),
    );

    expect(orphanLinks).toHaveLength(1);
    expect(orphanNodes).toHaveLength(0);
    expect(orphanLinks[0]).toEqual(IDS.OrphanPump);
  });

  it("does not report orphan nodes for nodes connected to valves or pumps", () => {
    const IDS = { T1: 1, J1: 2, V1: 3, PU1: 4, J2: 5, P1: 6 } as const;
    const model = HydraulicModelBuilder.with()
      .aTank(IDS.T1)
      .aJunction(IDS.J1)
      .aValve(IDS.V1, {
        startNodeId: IDS.T1,
        endNodeId: IDS.J1,
      })
      .aPump(IDS.PU1, {
        startNodeId: IDS.T1,
        endNodeId: IDS.J1,
      })
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const { orphanLinks, orphanNodes } = findOrphanAssets(
      model.topology,
      model.assetIndex,
      new AssetTypeQueries(model.assets),
    );

    expect(orphanLinks).toHaveLength(0);
    expect(orphanNodes).toHaveLength(0);
  });
});
