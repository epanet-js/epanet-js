import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { findCrossingPipes } from "./find-crossing-pipes";
import {
  EncodedHydraulicModel,
  HydraulicModelEncoder,
} from "../hydraulic-model-buffers";
import { HydraulicModel } from "src/hydraulic-model";

describe("findCrossingPipes", () => {
  function encodeData(model: HydraulicModel): EncodedHydraulicModel {
    const encoder = new HydraulicModelEncoder(model, {
      nodes: new Set(["bounds", "geoIndex"]),
      links: new Set(["connections", "bounds", "geoIndex"]),
      bufferType: "array",
    });
    return encoder.buildBuffers();
  }

  describe("Basic crossing detection", () => {
    it("finds pipes that cross each other", () => {
      const model = HydraulicModelBuilder.with()
        // Vertical pipe
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        // Horizontal pipe crossing at (0, 5)
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);
      expect(linkIdsLookup[crossings[0].pipe1Id]).toEqual("P1");
      expect(linkIdsLookup[crossings[0].pipe2Id]).toEqual("P2");
      expect(crossings[0].intersectionPoint[0]).toBeCloseTo(0, 5);
      expect(crossings[0].intersectionPoint[1]).toBeCloseTo(5, 5);
    });

    it("finds multiple crossings in network", () => {
      const model = HydraulicModelBuilder.with()
        // First crossing: P1 x P2
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        // Second crossing: P3 x P4
        .aJunction("J5", { coordinates: [20, 0] })
        .aJunction("J6", { coordinates: [20, 10] })
        .aPipe("P3", { startNodeId: "J5", endNodeId: "J6" })
        .aJunction("J7", { coordinates: [15, 5] })
        .aJunction("J8", { coordinates: [25, 5] })
        .aPipe("P4", { startNodeId: "J7", endNodeId: "J8" })
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(2);

      const pairIds = crossings.map((c) => [
        linkIdsLookup[c.pipe1Id],
        linkIdsLookup[c.pipe2Id],
      ]);
      expect(pairIds).toContainEqual(["P1", "P2"]);
      expect(pairIds).toContainEqual(["P3", "P4"]);
    });
  });

  describe("Junction tolerance filtering", () => {
    it("does not report intersections near junctions", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        // Junction very close to where P2 crosses P1
        .aJunction("JNearby", { coordinates: [0.0003, 5] }) // ~33m away
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      // Tolerance 50m - should exclude this crossing
      const crossings = findCrossingPipes(data, 50);

      expect(crossings).toHaveLength(0);
    });

    it("reports crossings far from junctions", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);
    });

    it("respects custom junction tolerance parameter", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        // Add a junction near the crossing
        .aJunction("JNearby", { coordinates: [0.0008, 5] }) // ~89m from intersection at (0, 5)
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      // With small tolerance (0.0005 degrees ~55m): should find crossing (junction is 89m away)
      const crossingsSmall = findCrossingPipes(data, 0.0005);
      expect(crossingsSmall).toHaveLength(1);

      // With larger tolerance (0.001 degrees ~111m): should NOT find crossing (filters out intersections within 111m)
      const crossingsLarge = findCrossingPipes(data, 0.001);
      expect(crossingsLarge).toHaveLength(0);
    });
  });

  describe("Geometric accuracy with pipe segments", () => {
    it("detects crossings in curved pipes", () => {
      const model = HydraulicModelBuilder.with()
        // Curved pipe with 3 segments
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [2, 3],
            [2, 7],
            [0, 10],
          ],
        })
        // Straight pipe crossing one of P1's segments
        .aJunction("J3", { coordinates: [0, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);
      expect(linkIdsLookup[crossings[0].pipe1Id]).toEqual("P1");
      expect(linkIdsLookup[crossings[0].pipe2Id]).toEqual("P2");
    });

    it("handles pipes with complex S-curve geometries", () => {
      const model = HydraulicModelBuilder.with()
        // S-curve pipe
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 20] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [5, 5],
            [5, 10],
            [-5, 15],
            [0, 20],
          ],
        })
        // Pipe crossing the S-curve
        .aJunction("J3", { coordinates: [-10, 12] })
        .aJunction("J4", { coordinates: [10, 12] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);
    });
  });

  describe("Edge cases", () => {
    it("handles networks with no crossings", () => {
      const model = HydraulicModelBuilder.with()
        // Parallel pipes
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [5, 0] })
        .aJunction("J4", { coordinates: [5, 10] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(0);
    });

    it("reports same pipe pair only once even with multiple intersection points", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [3, 3],
            [7, -3],
            [10, 0],
          ],
        })
        .aJunction("J3", { coordinates: [0, 0] })
        .aJunction("J4", { coordinates: [10, 0] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);

      const pipe1 = linkIdsLookup[crossings[0].pipe1Id];
      const pipe2 = linkIdsLookup[crossings[0].pipe2Id];
      expect(pipe1).toEqual("P1");
      expect(pipe2).toEqual("P2");
    });

    it("handles pipes that touch at endpoints (T-junction)", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [10, 10] })
        .aPipe("P2", { startNodeId: "J2", endNodeId: "J3" })
        .build();
      const { nodeIdsLookup, linkIdsLookup, ...data } = encodeData(model);

      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(0);
    });
  });
});
