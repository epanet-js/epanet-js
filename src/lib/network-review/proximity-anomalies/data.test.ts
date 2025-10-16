import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  TopologyBufferView,
  encodeHydraulicModel,
  SegmentsGeometriesBufferView,
} from "./data";

describe("HydraulicModel encoding/decoding", () => {
  it("encodes and decodes nodes correctly", () => {
    const model = HydraulicModelBuilder.with()
      .aTank("T1", { coordinates: [1, 2] })
      .aJunction("J1", { coordinates: [3, 4] })
      .aPipe("P1", { startNodeId: "T1", endNodeId: "J1" })
      .build();

    const { nodeBuffer, linksBuffer, idsLookup } = encodeHydraulicModel(model);

    const view = new TopologyBufferView(nodeBuffer, linksBuffer);

    const nodes = Array.from(view.nodes());
    expect(nodes).toHaveLength(2);

    const nodeIds = nodes.map((n) => idsLookup[n.id]);
    expect(nodeIds).toContain("T1");
    expect(nodeIds).toContain("J1");

    const t1Idx = idsLookup.findIndex((id) => id === "T1");
    const t1 = view.getNodeByIndex(t1Idx);
    expect(t1?.position).toEqual([1, 2]);
  });

  it("encodes and decodes links correctly", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 10] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const { nodeBuffer, linksBuffer, idsLookup } = encodeHydraulicModel(model);

    const view = new TopologyBufferView(nodeBuffer, linksBuffer);

    const links = Array.from(view.links());
    expect(links).toHaveLength(1);

    const link = links[0];
    expect(idsLookup[link.id]).toEqual("P1");
    expect(idsLookup[link.startNode]).toEqual("J1");
    expect(idsLookup[link.endNode]).toEqual("J2");
  });

  it("encodes pipe segments for spatial indexing", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 10] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        coordinates: [
          [0, 0],
          [0, 5],
          [0, 10],
        ],
      })
      .build();

    const { pipeSegmentsBuffer, idsLookup } = encodeHydraulicModel(model);

    const segmentsView = new SegmentsGeometriesBufferView(pipeSegmentsBuffer);

    expect(segmentsView.count).toEqual(2);

    const firstSegmentPipeId = segmentsView.getId(0);
    expect(idsLookup[firstSegmentPipeId]).toEqual("P1");

    const [start, end] = segmentsView.getCoordinates(0);
    expect(start).toEqual([0, 0]);
    expect(end).toEqual([0, 5]);
  });

  it("handles valves and pumps as links", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aValve("V1", { startNodeId: "J1", endNodeId: "J2" })
      .aJunction("J3", { coordinates: [20, 0] })
      .aPump("PU1", { startNodeId: "J2", endNodeId: "J3" })
      .build();

    const { nodeBuffer, linksBuffer, idsLookup } = encodeHydraulicModel(model);

    const view = new TopologyBufferView(nodeBuffer, linksBuffer);

    const links = Array.from(view.links());
    expect(links).toHaveLength(2);

    const linkIds = links.map((l) => idsLookup[l.id]);
    expect(linkIds).toContain("V1");
    expect(linkIds).toContain("PU1");
  });

  it("creates geo index for pipe segments", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [0, 10] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const { pipeSegmentsGeoIndex } = encodeHydraulicModel(model);

    expect(pipeSegmentsGeoIndex).toBeInstanceOf(ArrayBuffer);
    expect(pipeSegmentsGeoIndex.byteLength).toBeGreaterThan(0);
  });

  it("handles models with no pipes", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aReservoir("R1", { coordinates: [10, 0] })
      .build();

    const encoded = encodeHydraulicModel(model);

    expect(encoded.nodeBuffer).toBeInstanceOf(ArrayBuffer);
    expect(encoded.linksBuffer).toBeInstanceOf(ArrayBuffer);
    expect(encoded.pipeSegmentsBuffer).toBeInstanceOf(ArrayBuffer);

    const segmentsView = new SegmentsGeometriesBufferView(
      encoded.pipeSegmentsBuffer,
    );
    expect(segmentsView.count).toBe(0);
  });

  it("uses shared array buffer when requested", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const encoded = encodeHydraulicModel(model, "shared");

    expect(encoded.nodeBuffer).toBeInstanceOf(SharedArrayBuffer);
    expect(encoded.linksBuffer).toBeInstanceOf(SharedArrayBuffer);
    expect(encoded.pipeSegmentsBuffer).toBeInstanceOf(SharedArrayBuffer);
  });
});
