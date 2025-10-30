import { describe, it, expect } from "vitest";
import { Topology } from "./topology";
import { AssetIndex } from "../asset-index";
import { TopologyEncoder } from "./topologyEncoder";

describe("TopologyEncoder", () => {
  describe("Encoding correctness", () => {
    it("incremental encoding produces same result as full encoding", () => {
      const topology = new Topology();
      topology.addLink("1", "10", "20");
      topology.addLink("2", "20", "30");
      topology.addLink("3", "10", "30");

      const assetIndex = new AssetIndex();
      assetIndex.addLink(1);
      assetIndex.addLink(2);
      assetIndex.addLink(3);
      assetIndex.addNode(10);
      assetIndex.addNode(20);
      assetIndex.addNode(30);

      const fullEncoder = new TopologyEncoder(topology, assetIndex, "array");
      const fullBuffers = fullEncoder.encode();

      const incrementalEncoder = new TopologyEncoder(
        topology,
        assetIndex,
        "array",
      );

      for (const linkId of assetIndex.iterateLinkInternalIds()) {
        incrementalEncoder.encodeLink(linkId);
      }

      for (const nodeId of assetIndex.iterateNodeInternalIds()) {
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
});
