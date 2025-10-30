import { describe, it, expect } from "vitest";
import { Topology } from "./topology";
import { AssetIndex, AssetIndexView } from "../asset-index";
import { TopologyEncoder } from "./topologyEncoder";
import { TopologyView } from "./topologyView";

describe("TopologyView", () => {
  describe("Basic queries", () => {
    it("queries simple topology with one link", () => {
      const IDS = {
        P1: 1,
        J1: 10,
        J2: 20,
      } as const;

      const topology = new Topology();
      topology.addLink(String(IDS.P1), String(IDS.J1), String(IDS.J2));

      const assetIndex = new AssetIndex();
      assetIndex.addLink(IDS.P1);
      assetIndex.addNode(IDS.J1);
      assetIndex.addNode(IDS.J2);

      const encoder = new TopologyEncoder(topology, assetIndex, "array");
      const topologyBuffers = encoder.encode();

      const assetIndexEncoder = assetIndex.getEncoder("array");
      const assetIndexBuffer = assetIndexEncoder.encode(
        () => assetIndex.iterateLinkInternalIds(),
        () => assetIndex.iterateNodeInternalIds(),
      );
      const view = new TopologyView(
        topologyBuffers,
        new AssetIndexView(assetIndexBuffer),
      );

      expect(view.hasLink(IDS.P1)).toBe(true);
      expect(view.hasNode(IDS.J1)).toBe(true);
      expect(view.hasNode(IDS.J2)).toBe(true);

      expect(view.getNodes(IDS.P1)).toEqual([IDS.J1, IDS.J2]);
      expect(view.getLinks(IDS.J1)).toEqual([IDS.P1]);
      expect(view.getLinks(IDS.J2)).toEqual([IDS.P1]);
    });

    it("queries topology with multiple links and nodes", () => {
      const IDS = {
        P1: 1,
        P2: 2,
        P3: 3,
        J1: 10,
        J2: 20,
        J3: 30,
      } as const;

      const topology = new Topology();
      topology.addLink(String(IDS.P1), String(IDS.J1), String(IDS.J2));
      topology.addLink(String(IDS.P2), String(IDS.J2), String(IDS.J3));
      topology.addLink(String(IDS.P3), String(IDS.J1), String(IDS.J3));

      const assetIndex = new AssetIndex();
      assetIndex.addLink(IDS.P1);
      assetIndex.addLink(IDS.P2);
      assetIndex.addLink(IDS.P3);
      assetIndex.addNode(IDS.J1);
      assetIndex.addNode(IDS.J2);
      assetIndex.addNode(IDS.J3);

      const encoder = new TopologyEncoder(topology, assetIndex, "array");
      const topologyBuffers = encoder.encode();

      const assetIndexEncoder = assetIndex.getEncoder("array");
      const assetIndexBuffer = assetIndexEncoder.encode(
        () => assetIndex.iterateLinkInternalIds(),
        () => assetIndex.iterateNodeInternalIds(),
      );
      const view = new TopologyView(
        topologyBuffers,
        new AssetIndexView(assetIndexBuffer),
      );

      expect(view.getNodes(IDS.P1)).toEqual([IDS.J1, IDS.J2]);
      expect(view.getNodes(IDS.P2)).toEqual([IDS.J2, IDS.J3]);
      expect(view.getNodes(IDS.P3)).toEqual([IDS.J1, IDS.J3]);

      expect(view.getLinks(IDS.J1)).toContain(IDS.P1);
      expect(view.getLinks(IDS.J1)).toContain(IDS.P3);
      expect(view.getLinks(IDS.J2)).toContain(IDS.P1);
      expect(view.getLinks(IDS.J2)).toContain(IDS.P2);
      expect(view.getLinks(IDS.J3)).toContain(IDS.P2);
      expect(view.getLinks(IDS.J3)).toContain(IDS.P3);
    });

    it("handles empty topology", () => {
      const IDS = {
        NonExistentLink: 0,
        NonExistentNode: 0,
      } as const;

      const topology = new Topology();
      const assetIndex = new AssetIndex();

      const encoder = new TopologyEncoder(topology, assetIndex, "array");
      const topologyBuffers = encoder.encode();

      const assetIndexEncoder = assetIndex.getEncoder("array");
      const assetIndexBuffer = assetIndexEncoder.encode(
        () => assetIndex.iterateLinkInternalIds(),
        () => assetIndex.iterateNodeInternalIds(),
      );
      const view = new TopologyView(
        topologyBuffers,
        new AssetIndexView(assetIndexBuffer),
      );

      expect(view.hasLink(IDS.NonExistentLink)).toBe(false);
      expect(view.hasNode(IDS.NonExistentNode)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("handles node with multiple connections", () => {
      const IDS = {
        P1: 1,
        P2: 2,
        P3: 3,
        P4: 4,
        J1: 10,
        J2: 20,
        J3: 30,
        J4: 40,
        CentralNode: 100,
      } as const;

      const topology = new Topology();
      topology.addLink(String(IDS.P1), String(IDS.J1), String(IDS.CentralNode));
      topology.addLink(String(IDS.P2), String(IDS.CentralNode), String(IDS.J2));
      topology.addLink(String(IDS.P3), String(IDS.CentralNode), String(IDS.J3));
      topology.addLink(String(IDS.P4), String(IDS.CentralNode), String(IDS.J4));

      const assetIndex = new AssetIndex();
      assetIndex.addLink(IDS.P1);
      assetIndex.addLink(IDS.P2);
      assetIndex.addLink(IDS.P3);
      assetIndex.addLink(IDS.P4);
      assetIndex.addNode(IDS.J1);
      assetIndex.addNode(IDS.CentralNode);
      assetIndex.addNode(IDS.J2);
      assetIndex.addNode(IDS.J3);
      assetIndex.addNode(IDS.J4);

      const encoder = new TopologyEncoder(topology, assetIndex, "array");
      const topologyBuffers = encoder.encode();

      const assetIndexEncoder = assetIndex.getEncoder("array");
      const assetIndexBuffer = assetIndexEncoder.encode(
        () => assetIndex.iterateLinkInternalIds(),
        () => assetIndex.iterateNodeInternalIds(),
      );
      const view = new TopologyView(
        topologyBuffers,
        new AssetIndexView(assetIndexBuffer),
      );

      const links = view.getLinks(IDS.CentralNode);

      expect(links.length).toBe(4);
      expect(links).toContain(IDS.P1);
      expect(links).toContain(IDS.P2);
      expect(links).toContain(IDS.P3);
      expect(links).toContain(IDS.P4);
    });
  });

  describe("Buffer types", () => {
    it("reads from SharedArrayBuffer", () => {
      const IDS = {
        P1: 1,
        J1: 10,
        J2: 20,
      } as const;

      const topology = new Topology();
      topology.addLink(String(IDS.P1), String(IDS.J1), String(IDS.J2));

      const assetIndex = new AssetIndex();
      assetIndex.addLink(IDS.P1);
      assetIndex.addNode(IDS.J1);
      assetIndex.addNode(IDS.J2);

      const encoder = new TopologyEncoder(topology, assetIndex, "shared");
      const topologyBuffers = encoder.encode();

      expect(topologyBuffers.linkConnections).toBeInstanceOf(SharedArrayBuffer);
      expect(topologyBuffers.nodeConnections.data).toBeInstanceOf(
        SharedArrayBuffer,
      );
      expect(topologyBuffers.nodeConnections.index).toBeInstanceOf(
        SharedArrayBuffer,
      );

      const assetIndexEncoder = assetIndex.getEncoder("shared");
      const assetIndexBuffer = assetIndexEncoder.encode(
        () => assetIndex.iterateLinkInternalIds(),
        () => assetIndex.iterateNodeInternalIds(),
      );
      const view = new TopologyView(
        topologyBuffers,
        new AssetIndexView(assetIndexBuffer),
      );

      expect(view.hasLink(IDS.P1)).toBe(true);
    });
  });

  describe("Incremental encoding", () => {
    it("reads topology encoded incrementally", () => {
      const IDS = {
        P1: 1,
        P2: 2,
        J1: 10,
        J2: 20,
        J3: 30,
      } as const;

      const topology = new Topology();
      topology.addLink(String(IDS.P1), String(IDS.J1), String(IDS.J2));
      topology.addLink(String(IDS.P2), String(IDS.J2), String(IDS.J3));

      const assetIndex = new AssetIndex();
      assetIndex.addLink(IDS.P1);
      assetIndex.addLink(IDS.P2);
      assetIndex.addNode(IDS.J1);
      assetIndex.addNode(IDS.J2);
      assetIndex.addNode(IDS.J3);

      const encoder = new TopologyEncoder(topology, assetIndex, "array");

      for (const linkId of assetIndex.iterateLinkInternalIds()) {
        encoder.encodeLink(linkId);
      }

      for (const nodeId of assetIndex.iterateNodeInternalIds()) {
        encoder.encodeNode(nodeId);
      }

      const topologyBuffers = encoder.finalize();

      const assetIndexEncoder = assetIndex.getEncoder("array");
      const assetIndexBuffer = assetIndexEncoder.encode(
        () => assetIndex.iterateLinkInternalIds(),
        () => assetIndex.iterateNodeInternalIds(),
      );
      const view = new TopologyView(
        topologyBuffers,
        new AssetIndexView(assetIndexBuffer),
      );

      expect(view.getNodes(IDS.P1)).toEqual([IDS.J1, IDS.J2]);
      expect(view.getNodes(IDS.P2)).toEqual([IDS.J2, IDS.J3]);
      expect(view.getLinks(IDS.J2)).toContain(IDS.P1);
      expect(view.getLinks(IDS.J2)).toContain(IDS.P2);
    });
  });
});
