import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { classifyOrphan } from "./classify-orphan";
import { findOrphanAssets } from "./find-orphan-assets";

describe("classifyOrphan", () => {
  it("classifies a node with no connections as an isolated node", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, Orphan: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.Orphan)
      .build();

    expect(
      classifyOrphan(IDS.Orphan, model.topology, model.assetIndex),
    ).toEqual("isolatedNode");
  });

  it("classifies a valve isolated on both ends as an isolated link", () => {
    const IDS = { T1: 1, N1: 2, Valve: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aTank(IDS.T1)
      .aJunction(IDS.N1)
      .aValve(IDS.Valve, { startNodeId: IDS.T1, endNodeId: IDS.N1 })
      .build();

    expect(classifyOrphan(IDS.Valve, model.topology, model.assetIndex)).toEqual(
      "isolatedLink",
    );
  });

  it("classifies a link with a missing endpoint as a dangling link", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    model.assets.delete(IDS.J2);
    model.assetIndex.removeNode(IDS.J2);

    expect(classifyOrphan(IDS.P1, model.topology, model.assetIndex)).toEqual(
      "danglingLink",
    );
  });

  it("returns null for assets that are not orphans", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    expect(classifyOrphan(IDS.P1, model.topology, model.assetIndex)).toBeNull();
    expect(classifyOrphan(IDS.J1, model.topology, model.assetIndex)).toBeNull();
  });

  it("agrees with findOrphanAssets on every asset it reports", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 3,
      LoneJunction: 4,
      T1: 5,
      N1: 6,
      OrphanValve: 7,
      DoomedJunction: 8,
      DanglingPipe: 9,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aJunction(IDS.LoneJunction)
      .aTank(IDS.T1)
      .aJunction(IDS.N1)
      .aValve(IDS.OrphanValve, { startNodeId: IDS.T1, endNodeId: IDS.N1 })
      .aJunction(IDS.DoomedJunction)
      .aPipe(IDS.DanglingPipe, {
        startNodeId: IDS.J1,
        endNodeId: IDS.DoomedJunction,
      })
      .build();

    model.assets.delete(IDS.DoomedJunction);
    model.assetIndex.removeNode(IDS.DoomedJunction);

    const { orphanNodes, orphanLinks } = findOrphanAssets(
      model.topology,
      model.assetIndex,
    );
    const reported = [...orphanNodes, ...orphanLinks];
    expect(reported.length).toBeGreaterThan(0);

    for (const assetId of reported) {
      expect(
        classifyOrphan(assetId, model.topology, model.assetIndex),
      ).not.toBeNull();
    }
  });
});
