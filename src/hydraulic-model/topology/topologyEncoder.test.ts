import { describe, it, expect } from "vitest";
import { TopologyEncoder } from "./topologyEncoder";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("TopologyEncoder", () => {
  it("incremental encoding produces same result as full encoding", () => {
    const IDS = {
      P1: 1,
      P2: 2,
      P3: 3,
      P4: 4,
      J1: 10,
      J2: 20,
      J3: 30,
      J4: 40,
      JC: 50,
    } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aJunction(IDS.JC)
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.JC })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.JC })
      .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.JC })
      .aPipe(IDS.P4, { startNodeId: IDS.J4, endNodeId: IDS.JC })
      .build();

    const fullEncoder = new TopologyEncoder(model.topology, model.assetIndex);
    const fullBuffers = fullEncoder.encode();

    const incrementalEncoder = new TopologyEncoder(
      model.topology,
      model.assetIndex,
    );
    for (const [linkId] of model.assetIndex.iterateLinks()) {
      incrementalEncoder.encodeLink(linkId);
    }
    for (const [nodeId] of model.assetIndex.iterateNodes()) {
      incrementalEncoder.encodeNode(nodeId);
    }

    const incrementalBuffers = incrementalEncoder.finalize();

    expect(new Uint8Array(incrementalBuffers.linkConnections)).toEqual(
      new Uint8Array(fullBuffers.linkConnections),
    );
    expect(new Uint8Array(incrementalBuffers.nodeConnections.data)).toEqual(
      new Uint8Array(fullBuffers.nodeConnections.data),
    );
    expect(new Uint8Array(incrementalBuffers.nodeConnections.index)).toEqual(
      new Uint8Array(fullBuffers.nodeConnections.index),
    );
  });
});
