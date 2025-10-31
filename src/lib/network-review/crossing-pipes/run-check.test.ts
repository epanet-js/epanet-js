import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { runCheck } from "./run-check";

describe("runCheck", () => {
  describe("Basic integration", () => {
    it("identifies crossing pipes in hydraulic model", async () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, P2: 6 } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [0, 10] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .aJunction(IDS.J3, { coordinates: [-5, 5] })
        .aJunction(IDS.J4, { coordinates: [5, 5] })
        .aPipe(IDS.P2, {
          startNodeId: String(IDS.J3),
          endNodeId: String(IDS.J4),
        })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toEqual([
        expect.objectContaining({
          pipe1Id: String(IDS.P1),
          pipe2Id: String(IDS.P2),
          intersectionPoint: expect.any(Array),
        }),
      ]);

      // Verify intersection point is approximately correct
      expect(crossings[0].intersectionPoint[0]).toBeCloseTo(0, 5);
      expect(crossings[0].intersectionPoint[1]).toBeCloseTo(5, 5);
    });

    it("returns CrossingPipe objects with correct properties", async () => {
      const IDS = { J1: 1, J2: 2, PipeA: 3, J3: 4, J4: 5, PipeB: 6 } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [0, 10] })
        .aPipe(IDS.PipeA, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .aJunction(IDS.J3, { coordinates: [-5, 5] })
        .aJunction(IDS.J4, { coordinates: [5, 5] })
        .aPipe(IDS.PipeB, {
          startNodeId: String(IDS.J3),
          endNodeId: String(IDS.J4),
        })
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
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, P2: 6 } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [0, 10] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        // Parallel pipe - no crossing
        .aJunction(IDS.J3, { coordinates: [5, 0] })
        .aJunction(IDS.J4, { coordinates: [5, 10] })
        .aPipe(IDS.P2, {
          startNodeId: String(IDS.J3),
          endNodeId: String(IDS.J4),
        })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toEqual([]);
    });
  });

  describe("Custom parameters", () => {
    it("accepts custom junction tolerance parameter", async () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 3,
        J3: 4,
        J4: 5,
        P2: 6,
        JNearby: 7,
      } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [0, 10] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .aJunction(IDS.J3, { coordinates: [-5, 5] })
        .aJunction(IDS.J4, { coordinates: [5, 5] })
        .aPipe(IDS.P2, {
          startNodeId: String(IDS.J3),
          endNodeId: String(IDS.J4),
        })
        // Add a junction near the crossing point
        .aJunction(IDS.JNearby, { coordinates: [0.0008, 5] }) // ~89m from intersection at (0,5)
        .build();

      // With small tolerance (0.0005 degrees ~55m): should find crossing (junction is 89m away)
      const crossingsSmall = await runCheck(model, 0.0005);
      expect(crossingsSmall).toHaveLength(1);

      // With larger tolerance (0.001 degrees ~111m): should NOT find crossing (filters out intersections within 111m)
      const crossingsLarge = await runCheck(model, 0.001);
      expect(crossingsLarge).toHaveLength(0);
    });

    it("uses default tolerance when not specified", async () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, P2: 6 } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [0, 10] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .aJunction(IDS.J3, { coordinates: [-5, 5] })
        .aJunction(IDS.J4, { coordinates: [5, 5] })
        .aPipe(IDS.P2, {
          startNodeId: String(IDS.J3),
          endNodeId: String(IDS.J4),
        })
        .build();

      // Should use default 0.5m tolerance
      const crossings = await runCheck(model);

      expect(crossings).toHaveLength(1);
    });
  });

  describe("Data transformation", () => {
    it("converts encoded indices to asset IDs", async () => {
      const IDS = {
        Junction_1: 1,
        Junction_2: 2,
        MainPipe_A: 3,
        Junction_3: 4,
        Junction_4: 5,
        MainPipe_B: 6,
      } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.Junction_1, { coordinates: [0, 0] })
        .aJunction(IDS.Junction_2, { coordinates: [0, 10] })
        .aPipe(IDS.MainPipe_A, {
          startNodeId: String(IDS.Junction_1),
          endNodeId: String(IDS.Junction_2),
        })
        .aJunction(IDS.Junction_3, { coordinates: [-5, 5] })
        .aJunction(IDS.Junction_4, { coordinates: [5, 5] })
        .aPipe(IDS.MainPipe_B, {
          startNodeId: String(IDS.Junction_3),
          endNodeId: String(IDS.Junction_4),
        })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toHaveLength(1);
      expect(crossings[0].pipe1Id).toBe(String(IDS.MainPipe_A));
      expect(crossings[0].pipe2Id).toBe(String(IDS.MainPipe_B));
    });

    it("includes intersection coordinates", async () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, P2: 6 } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [10, 20] })
        .aJunction(IDS.J2, { coordinates: [10, 30] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .aJunction(IDS.J3, { coordinates: [5, 25] })
        .aJunction(IDS.J4, { coordinates: [15, 25] })
        .aPipe(IDS.P2, {
          startNodeId: String(IDS.J3),
          endNodeId: String(IDS.J4),
        })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toHaveLength(1);
      expect(crossings[0].intersectionPoint[0]).toBeCloseTo(10, 5);
      expect(crossings[0].intersectionPoint[1]).toBeCloseTo(25, 5);
    });

    it("detects crossings with standard pipe sizes", async () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, P2: 6 } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [0, 10] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .aJunction(IDS.J3, { coordinates: [-5, 5] })
        .aJunction(IDS.J4, { coordinates: [5, 5] })
        .aPipe(IDS.P2, {
          startNodeId: String(IDS.J3),
          endNodeId: String(IDS.J4),
        })
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
      const IDS = {
        R1: 1,
        J1: 2,
        Main1: 3,
        J2: 4,
        J3: 5,
        Main2: 6,
        S1: 7,
        S2: 8,
        Service1: 9,
        S3: 10,
        S4: 11,
        Service2: 12,
      } as const;
      const model = HydraulicModelBuilder.with()
        // Main distribution lines (grid pattern)
        .aReservoir(IDS.R1, { coordinates: [0, 0] })
        .aJunction(IDS.J1, { coordinates: [100, 0] })
        .aPipe(IDS.Main1, {
          startNodeId: String(IDS.R1),
          endNodeId: String(IDS.J1),
        })
        .aJunction(IDS.J2, { coordinates: [0, 100] })
        .aJunction(IDS.J3, { coordinates: [100, 100] })
        .aPipe(IDS.Main2, {
          startNodeId: String(IDS.J2),
          endNodeId: String(IDS.J3),
        })
        // Service lines that incorrectly cross mains
        .aJunction(IDS.S1, { coordinates: [50, -20] })
        .aJunction(IDS.S2, { coordinates: [50, 120] })
        .aPipe(IDS.Service1, {
          startNodeId: String(IDS.S1),
          endNodeId: String(IDS.S2),
        })
        .aJunction(IDS.S3, { coordinates: [-20, 50] })
        .aJunction(IDS.S4, { coordinates: [120, 50] })
        .aPipe(IDS.Service2, {
          startNodeId: String(IDS.S3),
          endNodeId: String(IDS.S4),
        })
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
      const IDS = {
        R1: 1,
        J1: 2,
        P1: 3,
        J2: 4,
        P2: 5,
        J3: 6,
        J4: 7,
        P3: 8,
      } as const;
      const model = HydraulicModelBuilder.with()
        // Network with both legitimate junctions and actual crossings
        .aReservoir(IDS.R1, { coordinates: [0, 0] })
        .aJunction(IDS.J1, { coordinates: [50, 0] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.R1),
          endNodeId: String(IDS.J1),
        })
        .aJunction(IDS.J2, { coordinates: [100, 0] })
        .aPipe(IDS.P2, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        }) // Legitimate T-junction at J1
        // Actual crossing (modeling error)
        .aJunction(IDS.J3, { coordinates: [25, -25] })
        .aJunction(IDS.J4, { coordinates: [25, 25] })
        .aPipe(IDS.P3, {
          startNodeId: String(IDS.J3),
          endNodeId: String(IDS.J4),
        }) // Crosses P1
        .build();

      const crossings = await runCheck(model, 0.5);

      // Should only find P1 x P3 crossing, not P1-P2 legitimate connection
      expect(crossings).toHaveLength(1);
      expect(crossings[0].pipe1Id).toBe(String(IDS.P1));
      expect(crossings[0].pipe2Id).toBe(String(IDS.P3));
    });

    it("handles network with curved pipes", async () => {
      const IDS = {
        R1: 1,
        J1: 2,
        CurvedMain: 3,
        S1: 4,
        S2: 5,
        ServiceLine: 6,
      } as const;
      const model = HydraulicModelBuilder.with()
        // Curved main line
        .aReservoir(IDS.R1, { coordinates: [0, 0] })
        .aJunction(IDS.J1, { coordinates: [100, 0] })
        .aPipe(IDS.CurvedMain, {
          startNodeId: String(IDS.R1),
          endNodeId: String(IDS.J1),
          coordinates: [
            [0, 0],
            [25, 10],
            [50, 15],
            [75, 10],
            [100, 0],
          ],
        })
        // Straight service line crossing the curve
        .aJunction(IDS.S1, { coordinates: [50, -20] })
        .aJunction(IDS.S2, { coordinates: [50, 30] })
        .aPipe(IDS.ServiceLine, {
          startNodeId: String(IDS.S1),
          endNodeId: String(IDS.S2),
        })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toHaveLength(1);
      expect(crossings[0].pipe1Id).toBe(String(IDS.CurvedMain));
      expect(crossings[0].pipe2Id).toBe(String(IDS.ServiceLine));
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
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 10] })
        .aPipe(IDS.P1, {
          startNodeId: String(IDS.J1),
          endNodeId: String(IDS.J2),
        })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toEqual([]);
    });

    it("handles network with no junctions", async () => {
      const IDS = { R1: 1, R2: 2 } as const;
      const model = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { coordinates: [0, 0] })
        .aReservoir(IDS.R2, { coordinates: [10, 10] })
        .build();

      const crossings = await runCheck(model, 0.5);

      expect(crossings).toEqual([]);
    });
  });
});
