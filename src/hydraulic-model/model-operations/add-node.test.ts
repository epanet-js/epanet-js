import { describe, expect, it } from "vitest";
import { addNode } from "./add-node";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("addNode", () => {
  describe("without pipe splitting (backward compatibility)", () => {
    it("adds a junction with generated label", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [10, 10],
        elevation: 100,
      });

      expect(putAssets).toHaveLength(1);
      const [junction] = putAssets!;
      expect(junction.type).toBe("junction");
      expect(junction.coordinates).toEqual([10, 10]);
      expect((junction as any).elevation).toBe(100);
      expect(junction.label).toBe("J1");
    });

    it("adds a reservoir with specified elevation", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "reservoir",
        coordinates: [20, 20],
        elevation: 150,
      });

      expect(putAssets).toHaveLength(1);
      const [reservoir] = putAssets!;
      expect(reservoir.type).toBe("reservoir");
      expect(reservoir.coordinates).toEqual([20, 20]);
      expect((reservoir as any).elevation).toBe(150);
      expect(reservoir.label).toBe("R1");
    });

    it("adds a tank with default elevation", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "tank",
        coordinates: [30, 30],
      });

      expect(putAssets).toHaveLength(1);
      const [tank] = putAssets!;
      expect(tank.type).toBe("tank");
      expect(tank.coordinates).toEqual([30, 30]);
      expect((tank as any).elevation).toBe(0);
      expect(tank.label).toBe("T1");
    });
  });

  describe("with pipe splitting", () => {
    it("splits a pipe and adds a junction", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const originalPipe = hydraulicModel.assets.get("P1");
      expect(originalPipe).toBeDefined();

      const { putAssets, deleteAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [5, 0],
        elevation: 50,
        pipeIdToSplit: "P1",
      });

      expect(putAssets).toHaveLength(3);
      expect(deleteAssets).toEqual(["P1"]);

      const [junction, pipe1, pipe2] = putAssets!;

      expect(junction.type).toBe("junction");
      expect(junction.coordinates).toEqual([5, 0]);
      expect((junction as any).elevation).toBe(50);

      expect(pipe1.type).toBe("pipe");
      expect(pipe2.type).toBe("pipe");
      expect(pipe1.coordinates).toEqual([
        [0, 0],
        [5, 0],
      ]);
      expect(pipe2.coordinates).toEqual([
        [5, 0],
        [10, 0],
      ]);

      expect((pipe1 as any).connections).toEqual(["J1", junction.id]);
      expect((pipe2 as any).connections).toEqual([junction.id, "J2"]);
    });

    it("generates unique labels for split pipes", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .aPipe("MainPipe", {
          startNodeId: "J1",
          endNodeId: "J2",
          label: "MainPipe",
        })
        .build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdToSplit: "MainPipe",
      });

      const [, pipe1, pipe2] = putAssets!;
      expect(pipe1.label).toBe("MainPipe_1");
      expect(pipe2.label).toBe("MainPipe_2");
    });

    it("handles label collisions by iterating", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .aNode("J3", [0, 5])
        .aNode("J4", [10, 5])
        .aPipe("TestPipe", {
          startNodeId: "J1",
          endNodeId: "J2",
          label: "TestPipe",
        })
        .aPipe("TestPipe_1", {
          startNodeId: "J3",
          endNodeId: "J4",
          label: "TestPipe_1",
        })
        .build();

      hydraulicModel.labelManager.register("TestPipe_1", "pipe", "TestPipe_1");

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdToSplit: "TestPipe",
      });

      const [, pipe1, pipe2] = putAssets!;
      expect(pipe1.label).toBe("TestPipe_1_1");
      expect(pipe2.label).toBe("TestPipe_2");
    });

    it("copies all properties from original pipe", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .build();

      const originalPipe = hydraulicModel.assetBuilder.buildPipe({
        label: "SpecialPipe",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });
      originalPipe.setProperty("diameter", 200);
      originalPipe.setProperty("roughness", 0.1);
      originalPipe.setProperty("minorLoss", 0.5);
      originalPipe.setProperty("initialStatus", "open");

      hydraulicModel.assets.set(originalPipe.id, originalPipe);

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdToSplit: originalPipe.id,
      });

      const [, pipe1, pipe2] = putAssets!;

      expect(pipe1.getProperty("diameter")).toBe(200);
      expect(pipe1.getProperty("roughness")).toBe(0.1);
      expect(pipe1.getProperty("minorLoss")).toBe(0.5);
      expect(pipe1.getProperty("initialStatus")).toBe("open");

      expect(pipe2.getProperty("diameter")).toBe(200);
      expect(pipe2.getProperty("roughness")).toBe(0.1);
      expect(pipe2.getProperty("minorLoss")).toBe(0.5);
      expect(pipe2.getProperty("initialStatus")).toBe("open");
    });

    it("recomputes lengths for split pipes", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [100, 0])
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [30, 0],
        pipeIdToSplit: "P1",
      });

      const [, pipe1, pipe2] = putAssets!;

      const length1 = pipe1.getProperty("length") as unknown as number;
      const length2 = pipe2.getProperty("length") as unknown as number;

      expect(length1).toBeGreaterThan(0);
      expect(length2).toBeGreaterThan(0);
      expect(length1 + length2).toBeCloseTo(11119508, 1);
    });

    it("splits pipe with multiple vertices", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 10])
        .build();

      const pipe = hydraulicModel.assetBuilder.buildPipe({
        id: "P1",
        coordinates: [
          [0, 0],
          [5, 0],
          [5, 5],
          [10, 10],
        ],
      });
      hydraulicModel.assets.set("P1", pipe);

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [5, 2.5],
        pipeIdToSplit: "P1",
      });

      const [junction, pipe1, pipe2] = putAssets!;

      expect(junction.coordinates).toEqual([5, 2.5]);
      expect(pipe1.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(pipe2.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(pipe1.coordinates[0]).toEqual([0, 0]);
      expect(pipe2.coordinates[pipe2.coordinates.length - 1]).toEqual([10, 10]);
    });

    it("throws error for invalid pipe ID", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();

      expect(() =>
        addNode(hydraulicModel, {
          nodeType: "junction",
          coordinates: [5, 0],
          pipeIdToSplit: "NonExistentPipe",
        }),
      ).toThrow("Invalid pipe ID: NonExistentPipe");
    });

    it("throws error when trying to split non-pipe asset", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .build();

      expect(() =>
        addNode(hydraulicModel, {
          nodeType: "junction",
          coordinates: [5, 0],
          pipeIdToSplit: "J1",
        }),
      ).toThrow("Invalid pipe ID: J1");
    });

    it("maintains network connectivity with proper connections", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("StartNode", [0, 0])
        .aNode("EndNode", [20, 0])
        .aPipe("MainPipe", {
          startNodeId: "StartNode",
          endNodeId: "EndNode",
          label: "MainPipe",
        })
        .build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [10, 0],
        pipeIdToSplit: "MainPipe",
      });

      const [newJunction, firstSegment, secondSegment] = putAssets!;

      expect((firstSegment as any).connections[0]).toBe("StartNode");
      expect((firstSegment as any).connections[1]).toBe(newJunction.id);
      expect((secondSegment as any).connections[0]).toBe(newJunction.id);
      expect((secondSegment as any).connections[1]).toBe("EndNode");
    });
  });

  describe("node type validation", () => {
    it("throws error for unsupported node type", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();

      expect(() =>
        addNode(hydraulicModel, {
          nodeType: "unsupported" as any,
          coordinates: [0, 0],
        }),
      ).toThrow("Unsupported node type: unsupported");
    });
  });
});
