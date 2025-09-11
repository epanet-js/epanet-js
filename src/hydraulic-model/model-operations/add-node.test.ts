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

    it("uses node coordinates exactly as split point", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const nodeCoordinates: [number, number] = [5.123, 0.456];

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: nodeCoordinates,
        elevation: 50,
        pipeIdToSplit: "P1",
      });

      const [junction, pipe1, pipe2] = putAssets!;

      expect(junction.coordinates).toEqual(nodeCoordinates);
      expect(pipe1.coordinates[pipe1.coordinates.length - 1]).toEqual(
        nodeCoordinates,
      );
      expect(pipe2.coordinates[0]).toEqual(nodeCoordinates);
    });

    it("integrates with pipe splitting operation", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .aPipe("MainPipe", {
          startNodeId: "J1",
          endNodeId: "J2",
          label: "MainPipe",
        })
        .build();

      const { putAssets, deleteAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdToSplit: "MainPipe",
      });

      expect(putAssets).toHaveLength(3);
      expect(deleteAssets).toEqual(["MainPipe"]);

      const [junction, pipe1, pipe2] = putAssets!;
      expect(junction.type).toBe("junction");
      expect(pipe1.type).toBe("pipe");
      expect(pipe2.type).toBe("pipe");
      expect(pipe1.label).toBe("MainPipe");
      expect(pipe2.label).toBe("MainPipe_1");
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
