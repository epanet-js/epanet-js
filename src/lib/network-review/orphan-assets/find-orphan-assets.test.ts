import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { findOrphanAssets } from "./find-orphan-assets";
import {
  EncodedHydraulicModel,
  HydraulicModelEncoder,
} from "../hydraulic-model-buffers";
import { HydraulicModel } from "src/hydraulic-model";

describe("findOrphanAssets", () => {
  function encodeData(model: HydraulicModel): EncodedHydraulicModel {
    const encoder = new HydraulicModelEncoder(model, {
      links: new Set(["connections", "types"]),
      nodes: new Set(["connections"]),
      bufferType: "array",
    });
    return encoder.buildBuffers();
  }

  it("should find nodes not connected to other assets in the network", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, Orphan: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aNode(IDS.J1)
      .aNode(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J1), endNodeId: String(IDS.J2) })
      .aNode(IDS.Orphan)
      .build();
    const { nodeIdsLookup, ...data } = encodeData(model);

    const { orphanLinks, orphanNodes } = findOrphanAssets(data);

    expect(orphanNodes).toHaveLength(1);
    expect(orphanLinks).toHaveLength(0);
    expect(nodeIdsLookup[orphanNodes[0]]).toEqual(String(IDS.Orphan));
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
      .aNode(IDS.J1)
      .aNode(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J1), endNodeId: String(IDS.J2) })
      .aTank(IDS.T1)
      .aNode(IDS.NoPipeNode)
      .aValve(IDS.OrphanValve, {
        startNodeId: String(IDS.T1),
        endNodeId: String(IDS.NoPipeNode),
      })
      .build();
    const { linkIdsLookup, ...data } = encodeData(model);

    const { orphanLinks, orphanNodes } = findOrphanAssets(data);

    expect(orphanLinks).toHaveLength(1);
    expect(orphanNodes).toHaveLength(0);
    expect(linkIdsLookup[orphanLinks[0]]).toEqual(String(IDS.OrphanValve));
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
      .aNode(IDS.J1)
      .aNode(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J1), endNodeId: String(IDS.J2) })
      .aTank(IDS.T1)
      .aNode(IDS.NoPipeNode)
      .aPump(IDS.OrphanPump, {
        startNodeId: String(IDS.T1),
        endNodeId: String(IDS.NoPipeNode),
      })
      .build();
    const { linkIdsLookup, ...data } = encodeData(model);

    const { orphanLinks, orphanNodes } = findOrphanAssets(data);

    expect(orphanLinks).toHaveLength(1);
    expect(orphanNodes).toHaveLength(0);
    expect(linkIdsLookup[orphanLinks[0]]).toEqual(String(IDS.OrphanPump));
  });

  it("does not report orphan nodes for nodes connected to valves or pumps", () => {
    const IDS = { T1: 1, J1: 2, V1: 3, PU1: 4, J2: 5, P1: 6 } as const;
    const model = HydraulicModelBuilder.with()
      .aTank(IDS.T1)
      .aNode(IDS.J1)
      .aValve(IDS.V1, {
        startNodeId: String(IDS.T1),
        endNodeId: String(IDS.J1),
      })
      .aPump(IDS.PU1, {
        startNodeId: String(IDS.T1),
        endNodeId: String(IDS.J1),
      })
      .aNode(IDS.J2)
      .aPipe(IDS.P1, { startNodeId: String(IDS.J1), endNodeId: String(IDS.J2) })
      .build();
    const data = encodeData(model);

    const { orphanLinks, orphanNodes } = findOrphanAssets(data);

    expect(orphanLinks).toHaveLength(0);
    expect(orphanNodes).toHaveLength(0);
  });
});
