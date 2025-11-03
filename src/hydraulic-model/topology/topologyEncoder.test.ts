import { describe, it, expect } from "vitest";
import { Topology } from "./topology";
import { AssetIndex } from "../asset-index";
import { TopologyEncoder } from "./topologyEncoder";

const IDS = {
  Link1: 1,
  Link2: 2,
  Link3: 3,
  Node10: 10,
  Node20: 20,
  Node30: 30,
} as const;

describe("TopologyEncoder", () => {
  describe("Encoding correctness", () => {
    it("incremental encoding produces same result as full encoding", () => {
      const topology = new Topology();
      topology.addLink(IDS.Link1, IDS.Node10, IDS.Node20);
      topology.addLink(IDS.Link2, IDS.Node20, IDS.Node30);
      topology.addLink(IDS.Link3, IDS.Node10, IDS.Node30);

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

      for (const linkId of assetIndex.iterateLinkAssetIds()) {
        incrementalEncoder.encodeLink(linkId);
      }

      for (const nodeId of assetIndex.iterateNodeAssetIds()) {
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
