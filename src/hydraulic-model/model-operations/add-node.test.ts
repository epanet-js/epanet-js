import { describe, expect, it } from "vitest";
import { addNode } from "./add-node";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";

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

    it("reconnects customer points when splitting pipe", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const customerPoint = buildCustomerPoint("CP1", {
        coordinates: [3, 1],
        demand: 75,
      });

      customerPoint.connect({
        pipeId: "P1",
        snapPoint: [3, 0],
        junctionId: "J1",
      });

      hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint);

      const { putAssets, putCustomerPoints } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdToSplit: "P1",
      });

      expect(putAssets).toHaveLength(3);
      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints).toHaveLength(1);

      const reconnectedCP = putCustomerPoints![0];
      const [newJunction, pipe1] = putAssets!;

      expect(reconnectedCP.connection?.pipeId).toBe(pipe1.id);
      expect(reconnectedCP.connection?.junctionId).toBe(newJunction.id);
      expect(reconnectedCP.baseDemand).toBe(75);
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

  describe("with FLAG_VERTEX_SNAP enabled", () => {
    it("removes matching vertex when adding node at vertex location", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [5, 0],
            [10, 0],
          ],
        })
        .build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdToSplit: "P1",
        enableVertexSnap: true,
      });

      const [, pipe1, pipe2] = putAssets!;

      expect(pipe1.coordinates).toEqual([
        [0, 0],
        [5, 0],
      ]);
      expect(pipe2.coordinates).toEqual([
        [5, 0],
        [10, 0],
      ]);
    });

    it("does not remove vertex when flag is disabled", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [5, 0],
            [10, 0],
          ],
        })
        .build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdToSplit: "P1",
        enableVertexSnap: false,
      });

      const [, pipe1, pipe2] = putAssets!;

      expect(pipe1.coordinates).toEqual([
        [0, 0],
        [5, 0],
      ]);
      expect(pipe2.coordinates).toEqual([
        [5, 0],
        [5, 0],
        [10, 0],
      ]);
    });

    it("handles multiple vertices correctly when adding node", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [20, 0])
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [5, 0],
            [10, 0],
            [15, 0],
            [20, 0],
          ],
        })
        .build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "reservoir",
        coordinates: [10, 0],
        pipeIdToSplit: "P1",
        enableVertexSnap: true,
      });

      const [reservoir, pipe1, pipe2] = putAssets!;

      expect(reservoir.type).toBe("reservoir");
      expect(pipe1.coordinates).toEqual([
        [0, 0],
        [5, 0],
        [10, 0],
      ]);
      expect(pipe2.coordinates).toEqual([
        [10, 0],
        [15, 0],
        [20, 0],
      ]);
    });

    it("works with tank node type at vertex location", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [0, 0])
        .aNode("J2", [10, 0])
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [5, 0],
            [10, 0],
          ],
        })
        .build();

      const { putAssets } = addNode(hydraulicModel, {
        nodeType: "tank",
        coordinates: [5, 0],
        elevation: 100,
        pipeIdToSplit: "P1",
        enableVertexSnap: true,
      });

      const [tank, pipe1, pipe2] = putAssets!;

      expect(tank.type).toBe("tank");
      expect(pipe1.coordinates).toEqual([
        [0, 0],
        [5, 0],
      ]);
      expect(pipe2.coordinates).toEqual([
        [5, 0],
        [10, 0],
      ]);
    });
  });
});
