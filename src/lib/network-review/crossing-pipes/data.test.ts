import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import Flatbush from "flatbush";
import {
  encodeHydraulicModel,
  decodeCrossingPipes,
  PipeBufferView,
  NodeBufferView,
  SegmentsGeometriesBufferView,
} from "./data";

describe("HydraulicModel encoding/decoding", () => {
  describe("Node encoding", () => {
    it("encodes nodes with spatial index correctly", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [1, 2] })
        .aJunction("J2", { coordinates: [3, 4] })
        .aTank("T1", { coordinates: [5, 6] })
        .build();

      const { nodeBuffer, nodeGeoIndex, idsLookup } =
        encodeHydraulicModel(model);

      // Verify buffer
      const nodeView = new NodeBufferView(nodeBuffer);
      expect(nodeView.count).toBe(3);

      const nodes = Array.from(nodeView.iter());
      expect(nodes).toHaveLength(3);

      // Verify spatial index exists
      expect(nodeGeoIndex).toBeInstanceOf(ArrayBuffer);
      expect(nodeGeoIndex.byteLength).toBeGreaterThan(0);

      // Verify can load and use spatial index
      const index = Flatbush.from(nodeGeoIndex);
      const nearest = index.neighbors(1, 2, 1);
      expect(nearest).toHaveLength(1);
      expect(idsLookup[nearest[0]]).toBe("J1");
    });

    it("handles models with no nodes", () => {
      const model = HydraulicModelBuilder.with().build();

      const { nodeBuffer, nodeGeoIndex } = encodeHydraulicModel(model);

      const nodeView = new NodeBufferView(nodeBuffer);
      expect(nodeView.count).toBe(0);

      // Index still created (with dummy entry)
      expect(nodeGeoIndex).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe("Pipe encoding", () => {
    it("encodes pipes with connections and positions", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const { pipeBuffer, idsLookup } = encodeHydraulicModel(model);

      const pipeView = new PipeBufferView(pipeBuffer);
      expect(pipeView.count).toBe(1);

      const pipes = Array.from(pipeView.iter());
      const pipe = pipes[0];

      expect(idsLookup[pipe.id]).toBe("P1");
      expect(idsLookup[pipe.startNode]).toBe("J1");
      expect(idsLookup[pipe.endNode]).toBe("J2");
      expect(pipe.bbox).toEqual([
        [0, 0],
        [10, 10],
      ]);
    });

    it("encodes only pipes, not valves or pumps", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [20, 0] })
        .aValve("V1", { startNodeId: "J2", endNodeId: "J3" })
        .aJunction("J4", { coordinates: [30, 0] })
        .aPump("PU1", { startNodeId: "J3", endNodeId: "J4" })
        .build();

      const { pipeBuffer } = encodeHydraulicModel(model);

      const pipeView = new PipeBufferView(pipeBuffer);
      expect(pipeView.count).toBe(1); // Only P1, not V1 or PU1
    });
  });

  describe("Pipe segments encoding", () => {
    it("encodes pipe segments for curved pipes", () => {
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

      // 2 segments: [0,0]->[0,5] and [0,5]->[0,10]
      expect(segmentsView.count).toBe(2);

      // First segment
      const firstSegmentPipeId = segmentsView.getId(0);
      expect(idsLookup[firstSegmentPipeId]).toBe("P1");
      const [start1, end1] = segmentsView.getCoordinates(0);
      expect(start1).toEqual([0, 0]);
      expect(end1).toEqual([0, 5]);

      // Second segment
      const secondSegmentPipeId = segmentsView.getId(1);
      expect(idsLookup[secondSegmentPipeId]).toBe("P1");
      const [start2, end2] = segmentsView.getCoordinates(1);
      expect(start2).toEqual([0, 5]);
      expect(end2).toEqual([0, 10]);
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

      // Verify can load index
      const index = Flatbush.from(pipeSegmentsGeoIndex);
      const candidates = index.search(-1, -1, 1, 11);
      expect(candidates.length).toBeGreaterThan(0);
    });

    it("handles models with no pipes", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aReservoir("R1", { coordinates: [10, 0] })
        .build();

      const { pipeSegmentsBuffer, pipeSegmentsGeoIndex } =
        encodeHydraulicModel(model);

      const segmentsView = new SegmentsGeometriesBufferView(pipeSegmentsBuffer);
      expect(segmentsView.count).toBe(0);

      // Index still created (with dummy entry)
      expect(pipeSegmentsGeoIndex).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe("SharedArrayBuffer support", () => {
    it("uses SharedArrayBuffer when requested", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const encoded = encodeHydraulicModel(model, "shared");

      expect(encoded.nodeBuffer).toBeInstanceOf(SharedArrayBuffer);
      // Note: Flatbush.data returns ArrayBuffer even when source is SharedArrayBuffer
      expect(encoded.nodeGeoIndex).toBeInstanceOf(ArrayBuffer);
      expect(encoded.pipeBuffer).toBeInstanceOf(SharedArrayBuffer);
      expect(encoded.pipeSegmentsBuffer).toBeInstanceOf(SharedArrayBuffer);
      expect(encoded.pipeSegmentsGeoIndex).toBeInstanceOf(ArrayBuffer);
    });

    it("uses regular ArrayBuffer by default", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const encoded = encodeHydraulicModel(model);

      expect(encoded.nodeBuffer).toBeInstanceOf(ArrayBuffer);
      expect(encoded.nodeGeoIndex).toBeInstanceOf(ArrayBuffer);
      expect(encoded.pipeBuffer).toBeInstanceOf(ArrayBuffer);
      expect(encoded.pipeSegmentsBuffer).toBeInstanceOf(ArrayBuffer);
      expect(encoded.pipeSegmentsGeoIndex).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe("Decoding crossing pipes", () => {
    it("decodes crossing pipes with correct asset IDs", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0], label: "Junction 1" })
        .aJunction("J2", { coordinates: [10, 0], label: "Junction 2" })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2", label: "Pipe 1" })
        .aJunction("J3", { coordinates: [0, 10], label: "Junction 3" })
        .aJunction("J4", { coordinates: [10, 10], label: "Junction 4" })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4", label: "Pipe 2" })
        .build();

      const idsLookup = ["J1", "J2", "P1", "J3", "J4", "P2"];

      // Simulated encoded crossing (P1 crosses P2)
      const encodedCrossings = [
        {
          pipe1Id: 2, // P1
          pipe2Id: 5, // P2
          intersectionPoint: [5, 5] as [number, number],
        },
      ];

      const crossings = decodeCrossingPipes(model, idsLookup, encodedCrossings);

      expect(crossings).toHaveLength(1);
      expect(crossings[0].pipe1Id).toBe("P1");
      expect(crossings[0].pipe2Id).toBe("P2");
      expect(crossings[0].intersectionPoint).toEqual([5, 5]);
    });

    it("sorts results by pipe diameters and then by labels", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        // P1: diameter 12
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          label: "Zebra",
          diameter: 12,
        })
        // P2: diameter 6
        .aPipe("P2", {
          startNodeId: "J1",
          endNodeId: "J2",
          label: "Alpha",
          diameter: 6,
        })
        // P3: diameter 8
        .aPipe("P3", {
          startNodeId: "J1",
          endNodeId: "J2",
          label: "Beta",
          diameter: 8,
        })
        // P4: diameter 6 (same as P2, different label)
        .aJunction("J3", { coordinates: [20, 0] })
        .aPipe("P4", {
          startNodeId: "J1",
          endNodeId: "J3",
          label: "Charlie",
          diameter: 6,
        })
        .build();

      const idsLookup = ["J1", "J2", "P1", "P2", "P3", "J3", "P4"];

      const encodedCrossings = [
        {
          pipe1Id: 2, // P1 (Zebra, diameter 12)
          pipe2Id: 3, // P2 (Alpha, diameter 6)
          intersectionPoint: [5, 5] as [number, number],
        },
        {
          pipe1Id: 2, // P1 (Zebra, diameter 12)
          pipe2Id: 4, // P3 (Beta, diameter 8)
          intersectionPoint: [5, 5] as [number, number],
        },
        {
          pipe1Id: 3, // P2 (Alpha, diameter 6)
          pipe2Id: 4, // P3 (Beta, diameter 8)
          intersectionPoint: [5, 5] as [number, number],
        },
        {
          pipe1Id: 3, // P2 (Alpha, diameter 6)
          pipe2Id: 6, // P4 (Charlie, diameter 6)
          intersectionPoint: [5, 5] as [number, number],
        },
      ];

      const crossings = decodeCrossingPipes(model, idsLookup, encodedCrossings);

      expect(crossings).toHaveLength(4);
      // Sorted by min diameter (smallest first), then max diameter, then by labels
      // Note: Pipes are now normalized so pipe1Id always has the smaller diameter
      // 1. P2 (6) x P4 (6) - min=6, max=6, smaller label="Alpha" first
      expect(crossings[0].pipe1Id).toBe("P2");
      expect(crossings[0].pipe2Id).toBe("P4");
      // 2. P2 (6) x P3 (8) - min=6, max=8
      expect(crossings[1].pipe1Id).toBe("P2");
      expect(crossings[1].pipe2Id).toBe("P3");
      // 3. P2 (6) x P1 (12) - min=6, max=12
      // Note: Pipes normalized so P2 (smaller diameter) is pipe1
      expect(crossings[2].pipe1Id).toBe("P2");
      expect(crossings[2].pipe2Id).toBe("P1");
      // 4. P3 (8) x P1 (12) - min=8, max=12
      // Note: Pipes normalized so P3 (smaller diameter) is pipe1
      expect(crossings[3].pipe1Id).toBe("P3");
      expect(crossings[3].pipe2Id).toBe("P1");
    });

    it("handles empty results", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const idsLookup = ["J1", "J2", "P1"];
      const encodedCrossings: any[] = [];

      const crossings = decodeCrossingPipes(model, idsLookup, encodedCrossings);

      expect(crossings).toEqual([]);
    });
  });
});
