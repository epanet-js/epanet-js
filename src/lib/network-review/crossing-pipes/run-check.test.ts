import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runCheck } from "./run-check";

describe("runCheck", () => {
  describe("Basic integration", () => {
    it("identifies crossing pipes in hydraulic model", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toEqual([
        expect.objectContaining({
          pipe1Id: "P1",
          pipe2Id: "P2",
          intersectionPoint: expect.any(Array),
        }),
      ]);

      // Verify intersection point is approximately correct
      expect(crossings[0].intersectionPoint[0]).toBeCloseTo(0, 5);
      expect(crossings[0].intersectionPoint[1]).toBeCloseTo(5, 5);
    });

    it("returns CrossingPipe objects with correct properties", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("PipeA", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("PipeB", { startNodeId: "J3", endNodeId: "J4" })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toHaveLength(1);

      const crossing = crossings[0];
      expect(crossing).toHaveProperty("pipe1Id");
      expect(crossing).toHaveProperty("pipe2Id");
      expect(crossing).toHaveProperty("intersectionPoint");

      // Verify types
      expect(typeof crossing.pipe1Id).toBe("string");
      expect(typeof crossing.pipe2Id).toBe("string");
      expect(Array.isArray(crossing.intersectionPoint)).toBe(true);
      expect(crossing.intersectionPoint).toHaveLength(2);
    });

    it("returns empty array when no crossings", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        // Parallel pipe - no crossing
        .aJunction("J3", { coordinates: [5, 0] })
        .aJunction("J4", { coordinates: [5, 10] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toEqual([]);
    });
  });

  describe("Custom parameters", () => {
    it("accepts custom junction tolerance parameter", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        // Add a junction near the crossing point
        .aJunction("JNearby", { coordinates: [0.0008, 5] }) // ~89m from intersection at (0,5)
        .build();

      // With small tolerance (0.0005 degrees ~55m): should find crossing (junction is 89m away)
      const crossingsSmall = await runCheck(model, 0.0005);
      expect(crossingsSmall).toHaveLength(1);

      // With larger tolerance (0.001 degrees ~111m): should NOT find crossing (filters out intersections within 111m)
      const crossingsLarge = await runCheck(model, 0.001);
      expect(crossingsLarge).toHaveLength(0);
    });

    it("uses default tolerance when not specified", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();

      // Should use default 0.5m tolerance
      const crossings = await runCheck(model);

      expect(crossings).toHaveLength(1);
    });
  });

  describe("Data transformation", () => {
    it("converts encoded indices to asset IDs", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("Junction_1", { coordinates: [0, 0] })
        .aJunction("Junction_2", { coordinates: [0, 10] })
        .aPipe("MainPipe_A", {
          startNodeId: "Junction_1",
          endNodeId: "Junction_2",
        })
        .aJunction("Junction_3", { coordinates: [-5, 5] })
        .aJunction("Junction_4", { coordinates: [5, 5] })
        .aPipe("MainPipe_B", {
          startNodeId: "Junction_3",
          endNodeId: "Junction_4",
        })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toHaveLength(1);
      expect(crossings[0].pipe1Id).toBe("MainPipe_A");
      expect(crossings[0].pipe2Id).toBe("MainPipe_B");
    });

    it("includes intersection coordinates", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [10, 20] })
        .aJunction("J2", { coordinates: [10, 30] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [5, 25] })
        .aJunction("J4", { coordinates: [15, 25] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toHaveLength(1);
      expect(crossings[0].intersectionPoint[0]).toBeCloseTo(10, 5);
      expect(crossings[0].intersectionPoint[1]).toBeCloseTo(25, 5);
    });

    it("detects crossings with standard pipe sizes", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [0, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aJunction("J3", { coordinates: [-5, 5] })
        .aJunction("J4", { coordinates: [5, 5] })
        .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toHaveLength(1);
      // Intersection should be at approximately (0, 5)
      expect(crossings[0].intersectionPoint[0]).toBeCloseTo(0, 5);
      expect(crossings[0].intersectionPoint[1]).toBeCloseTo(5, 5);
    });
  });

  describe("Real-world scenarios", () => {
    it("handles complex network with multiple crossings", async () => {
      const model = HydraulicModelBuilder.with()
        // Main distribution lines (grid pattern)
        .aReservoir("R1", { coordinates: [0, 0] })
        .aJunction("J1", { coordinates: [100, 0] })
        .aPipe("Main1", { startNodeId: "R1", endNodeId: "J1" })
        .aJunction("J2", { coordinates: [0, 100] })
        .aJunction("J3", { coordinates: [100, 100] })
        .aPipe("Main2", { startNodeId: "J2", endNodeId: "J3" })
        // Service lines that incorrectly cross mains
        .aJunction("S1", { coordinates: [50, -20] })
        .aJunction("S2", { coordinates: [50, 120] })
        .aPipe("Service1", { startNodeId: "S1", endNodeId: "S2" })
        .aJunction("S3", { coordinates: [-20, 50] })
        .aJunction("S4", { coordinates: [120, 50] })
        .aPipe("Service2", { startNodeId: "S3", endNodeId: "S4" })
        .build();

      const crossings = await runCheck(model, 0.5);

      // Should find multiple crossings
      expect(crossings.length).toBeGreaterThanOrEqual(2);

      // Each crossing should have valid data
      crossings.forEach((crossing) => {
        expect(crossing.pipe1Id).toBeTruthy();
        expect(crossing.pipe2Id).toBeTruthy();
        expect(crossing.intersectionPoint).toHaveLength(2);
      });
    });

    it("correctly filters out legitimate junctions", async () => {
      const model = HydraulicModelBuilder.with()
        // Network with both legitimate junctions and actual crossings
        .aReservoir("R1", { coordinates: [0, 0] })
        .aJunction("J1", { coordinates: [50, 0] })
        .aPipe("P1", { startNodeId: "R1", endNodeId: "J1" })
        .aJunction("J2", { coordinates: [100, 0] })
        .aPipe("P2", { startNodeId: "J1", endNodeId: "J2" }) // Legitimate T-junction at J1
        // Actual crossing (modeling error)
        .aJunction("J3", { coordinates: [25, -25] })
        .aJunction("J4", { coordinates: [25, 25] })
        .aPipe("P3", { startNodeId: "J3", endNodeId: "J4" }) // Crosses P1
        .build();

      const crossings = await runCheck(model, 0.5);

      // Should only find P1 x P3 crossing, not P1-P2 legitimate connection
      expect(crossings).toHaveLength(1);
      expect(crossings[0].pipe1Id).toBe("P1");
      expect(crossings[0].pipe2Id).toBe("P3");
    });

    it("handles network with curved pipes", async () => {
      const model = HydraulicModelBuilder.with()
        // Curved main line
        .aReservoir("R1", { coordinates: [0, 0] })
        .aJunction("J1", { coordinates: [100, 0] })
        .aPipe("CurvedMain", {
          startNodeId: "R1",
          endNodeId: "J1",
          coordinates: [
            [0, 0],
            [25, 10],
            [50, 15],
            [75, 10],
            [100, 0],
          ],
        })
        // Straight service line crossing the curve
        .aJunction("S1", { coordinates: [50, -20] })
        .aJunction("S2", { coordinates: [50, 30] })
        .aPipe("ServiceLine", { startNodeId: "S1", endNodeId: "S2" })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toHaveLength(1);
      expect(crossings[0].pipe1Id).toBe("CurvedMain");
      expect(crossings[0].pipe2Id).toBe("ServiceLine");
      // Intersection should be somewhere along the curve
      expect(crossings[0].intersectionPoint[0]).toBeCloseTo(50, 1);
    });
  });

  describe("Edge cases", () => {
    it("handles empty network", async () => {
      const model = HydraulicModelBuilder.with().build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toEqual([]);
    });

    it("handles network with only one pipe", async () => {
      const model = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 10] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toEqual([]);
    });

    it("handles network with no junctions", async () => {
      const model = HydraulicModelBuilder.with()
        .aReservoir("R1", { coordinates: [0, 0] })
        .aReservoir("R2", { coordinates: [10, 10] })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toEqual([]);
    });
  });
});
