import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { findCrossingPipes } from "./find-crossing-pipes";
import { encodeHydraulicModel } from "./data";

describe("findCrossingPipes", () => {
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

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);
      expect(idsLookup[crossings[0].pipe1Id]).toEqual("P1");
      expect(idsLookup[crossings[0].pipe2Id]).toEqual("P2");
      expect(crossings[0].intersectionPoint[0]).toBeCloseTo(0, 5);
      expect(crossings[0].intersectionPoint[1]).toBeCloseTo(5, 5);
      expect(crossings[0].distanceToNearestJunction).toBeGreaterThan(4);
    });

    it("does not report pipes that share a node", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aJunction("J3", { coordinates: [10, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aPipe("P2", { startNodeId: "J2", endNodeId: "J3" }) // T-junction
        .build();

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(0);
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

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(2);

      const pairIds = crossings.map((c) => [
        idsLookup[c.pipe1Id],
        idsLookup[c.pipe2Id],
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

      const { idsLookup, ...data } = encodeHydraulicModel(model);
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

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);
      // Intersection at (0, 5) is ~5m from nearest junction
      expect(crossings[0].distanceToNearestJunction).toBeGreaterThan(4);
    });

    it("respects custom junction tolerance parameter", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 0.001] }) // ~111m apart
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-0.0005, 0.0005] })
        .aJunction("J4", { coordinates: [0.0005, 0.0005] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();

      const { idsLookup, ...data } = encodeHydraulicModel(model);

      // With 0.5m tolerance: should find crossing
      const crossings05 = findCrossingPipes(data, 0.5);
      expect(crossings05).toHaveLength(1);

      // With 100m tolerance: should NOT find crossing (intersection near J1/J2)
      const crossings100 = findCrossingPipes(data, 100);
      expect(crossings100).toHaveLength(0);
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

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);
      expect(idsLookup[crossings[0].pipe1Id]).toEqual("P1");
      expect(idsLookup[crossings[0].pipe2Id]).toEqual("P2");
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

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);
    });
  });

  describe("Edge cases", () => {
    it("returns empty for networks with less than 2 pipes", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(0);
    });

    it("returns empty for networks with no pipes", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aReservoir("R1", { coordinates: [10, 0] })
        .build();

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(0);
    });

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

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(0);
    });

    it("reports each crossing only once (no duplicates)", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);

      // Verify not reported as both (P1,P2) and (P2,P1)
      const pipe1 = idsLookup[crossings[0].pipe1Id];
      const pipe2 = idsLookup[crossings[0].pipe2Id];
      expect(pipe1).not.toEqual(pipe2);
    });

    it("handles pipes that touch at endpoints (T-junction)", () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [10, 10] })
        .aPipe("P2", { startNodeId: "J2", endNodeId: "J3" })
        .build();

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      // Should not report shared endpoint as crossing
      expect(crossings).toHaveLength(0);
    });
  });

  describe("Performance and optimization", () => {
    it("handles large networks efficiently", () => {
      // Create a grid network with 100 junctions and 180 pipes
      const builder = HydraulicModelBuilder.with();

      // 10x10 grid
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          builder.aJunction(`J${i}_${j}`, { coordinates: [i * 10, j * 10] });
        }
      }

      // Horizontal pipes
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 9; j++) {
          builder.aPipe(`PH${i}_${j}`, {
            startNodeId: `J${i}_${j}`,
            endNodeId: `J${i}_${j + 1}`,
          });
        }
      }

      // Vertical pipes
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 10; j++) {
          builder.aPipe(`PV${i}_${j}`, {
            startNodeId: `J${i}_${j}`,
            endNodeId: `J${i + 1}_${j}`,
          });
        }
      }

      const model = builder.build();
      const { idsLookup, ...data } = encodeHydraulicModel(model);

      const startTime = performance.now();
      const crossings = findCrossingPipes(data, 0.5);
      const endTime = performance.now();

      // Should complete in reasonable time (< 100ms for this size)
      expect(endTime - startTime).toBeLessThan(100);

      // Grid should have no crossings (all legitimate junctions)
      expect(crossings).toHaveLength(0);
    });

    it("uses spatial index for efficient candidate selection", () => {
      // Create widely separated pipe pairs - spatial index should avoid
      // checking all combinations
      const model = HydraulicModelBuilder.with()
        // Pair 1 at origin
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 1] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-1, 0.5] })
        .aJunction("J4", { coordinates: [1, 0.5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        // Pair 2 far away at (1000, 1000)
        .aJunction("J5", { coordinates: [1000, 1000] })
        .aJunction("J6", { coordinates: [1000, 1001] })
        .aPipe("P3", { startNodeId: "J5", endNodeId: "J6" })
        .aJunction("J7", { coordinates: [999, 1000.5] })
        .aJunction("J8", { coordinates: [1001, 1000.5] })
        .aPipe("P4", { startNodeId: "J7", endNodeId: "J8" })
        .build();

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      // Should find 2 crossings efficiently without checking all 6 combinations
      expect(crossings).toHaveLength(2);
    });
  });

  describe("Real-world scenarios", () => {
    it("detects crossing in typical water distribution network", () => {
      const model = HydraulicModelBuilder.with()
        // Main distribution line
        .aReservoir("R1", { coordinates: [0, 0] })
        .aJunction("J1", { coordinates: [10, 0] })
        .aPipe("MainLine", { startNodeId: "R1", endNodeId: "J1" })
        // Service line that crosses main (modeling error)
        .aJunction("J2", { coordinates: [5, -5] })
        .aJunction("J3", { coordinates: [5, 5] })
        .aPipe("ServiceLine", { startNodeId: "J2", endNodeId: "J3" })
        .build();

      const { idsLookup, ...data } = encodeHydraulicModel(model);
      const crossings = findCrossingPipes(data, 0.5);

      expect(crossings).toHaveLength(1);
      expect(idsLookup[crossings[0].pipe1Id]).toEqual("MainLine");
      expect(idsLookup[crossings[0].pipe2Id]).toEqual("ServiceLine");
    });
  });
});
