import { describe, expect, it } from "vitest";
import { moveNode } from "./move-node";

import { NodeAsset, LinkAsset } from "../asset-types";
import { HydraulicModelBuilder } from "../../__helpers__/hydraulic-model-builder";

describe("moveNode", () => {
  it("updates the coordinates of a node", () => {
    const IDS = { A: 1 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.A, [10, 10])
      .build();
    const newCoordinates = [20, 20];
    const newElevation = 10;

    const { putAssets } = moveNode(hydraulicModel, {
      nodeId: IDS.A,
      newCoordinates,
      newElevation,
    });

    const updatedNode = putAssets![0] as NodeAsset;
    expect(updatedNode.id).toEqual(IDS.A);
    expect(updatedNode.coordinates).toEqual(newCoordinates);
    expect(updatedNode.elevation).toEqual(10);
  });

  it("updates the connected links", () => {
    const IDS = { A: 1, B: 2, C: 3, AB: 4, BC: 5 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.A, [10, 10])
      .aNode(IDS.B, [20, 20])
      .aNode(IDS.C, [30, 30])
      .aLink(IDS.AB, IDS.A, IDS.B, { length: 1 })
      .aLink(IDS.BC, IDS.B, IDS.C, { length: 2 })
      .build();
    const newCoordinates = [25, 25];
    const anyElevation = 10;

    const { putAssets } = moveNode(hydraulicModel, {
      nodeId: IDS.B,
      newCoordinates,
      newElevation: anyElevation,
    });

    expect(putAssets!.length).toEqual(3);
    const updatedNode = putAssets![0] as NodeAsset;
    expect(updatedNode.id).toEqual(IDS.B);
    expect(updatedNode.coordinates).toEqual(newCoordinates);

    const updatedAB = putAssets![1] as LinkAsset;
    expect(updatedAB.coordinates).toEqual([[10, 10], newCoordinates]);

    const updatedBC = putAssets![2] as LinkAsset;
    expect(updatedBC.coordinates).toEqual([newCoordinates, [30, 30]]);
  });

  describe("customer points", () => {
    it("updates customer point snap points when updateCustomerPoints is true", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode(IDS.J1, [10, 10])
        .aNode(IDS.J2, [30, 10])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [20, 15],
          demand: 1,
          connection: {
            pipeId: IDS.P1,
            snapPoint: [20, 10],
            junctionId: IDS.J1,
          },
        })
        .build();

      const newCoordinates = [10, 20];
      const { putAssets, putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: IDS.J1,
        newCoordinates,
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putAssets!.length).toBeGreaterThanOrEqual(2);
      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(1);

      const updatedCustomerPoint = putCustomerPoints![0];
      expect(updatedCustomerPoint.id).toEqual(String(IDS.CP1));
      expect(updatedCustomerPoint.connection!.snapPoint).not.toEqual([20, 10]);
    });

    it("does not update customer points when updateCustomerPoints is false", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode(IDS.J1, [10, 10])
        .aNode(IDS.J2, [30, 10])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [20, 15],
          demand: 1,
          connection: {
            pipeId: IDS.P1,
            snapPoint: [20, 10],
            junctionId: IDS.J1,
          },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: IDS.J1,
        newCoordinates: [10, 20],
        newElevation: 10,
        shouldUpdateCustomerPoints: false,
      });

      expect(putCustomerPoints).toBeUndefined();
    });

    it("skips customer points when none are connected to affected pipes", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode(IDS.J1, [10, 10])
        .aNode(IDS.J2, [30, 10])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: IDS.J1,
        newCoordinates: [15, 20],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeUndefined();
    });

    it("reallocates customer point to new junction when node move changes closest endpoint", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [20, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [5, 0],
          demand: 10,
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [5, 0],
          },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: IDS.J1,
        newCoordinates: [25, 0],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(1);

      const updatedCustomerPoint = putCustomerPoints![0];
      expect(updatedCustomerPoint.connection!.junctionId).toEqual(IDS.J2);
    });

    it("updates junction assignments when customer point stays with same junction", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [20, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [2, 0],
          demand: 10,
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [2, 0],
          },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: IDS.J1,
        newCoordinates: [0, 5],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(1);

      const updatedCustomerPoint = putCustomerPoints![0];
      expect(updatedCustomerPoint.connection!.junctionId).toEqual(IDS.J1);
      expect(updatedCustomerPoint.connection!.snapPoint).not.toEqual([2, 0]);
    });

    it("handles multiple customer points on same pipe with different junction assignments", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [30, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [5, 0],
          demand: 5,
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [5, 0],
          },
        })
        .aCustomerPoint(IDS.CP2, {
          coordinates: [25, 0],
          demand: 8,
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J2,
            snapPoint: [25, 0],
          },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: IDS.J1,
        newCoordinates: [35, 0],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(2);

      const updatedCP1 = putCustomerPoints!.find(
        (cp) => cp.id === String(IDS.CP1),
      )!;
      const updatedCP2 = putCustomerPoints!.find(
        (cp) => cp.id === String(IDS.CP2),
      )!;

      expect(updatedCP1.connection!.junctionId).toEqual(IDS.J2);
      expect(updatedCP2.connection!.junctionId).toEqual(IDS.J2);
    });

    it("assigns customer to correct junction after moving node with updated coordinates", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [-122.415, 37.7749] })
        .aJunction(IDS.J2, { coordinates: [-122.41, 37.7749] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [-122.414, 37.775],
          demand: 10,
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [-122.414, 37.7749],
          },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: IDS.J1,
        newCoordinates: [-122.405, 37.7749],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(1);

      const updatedCustomerPoint = putCustomerPoints![0];
      expect(updatedCustomerPoint.connection!.junctionId).toEqual(IDS.J2);
    });
  });

  it("splits pipe and connects moved node when pipeIdToSplit provided", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aNode(IDS.J3, [0, 10])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const { putAssets, deleteAssets } = moveNode(hydraulicModel, {
      nodeId: IDS.J3,
      newCoordinates: [5, 0],
      newElevation: 10,
      pipeIdToSplit: IDS.P1,
    });

    expect(deleteAssets).toEqual([IDS.P1]);
    expect(putAssets).toHaveLength(3);

    const [movedNode, pipe1, pipe2] = putAssets!;
    expect(movedNode.id).toBe(IDS.J3);
    expect(movedNode.coordinates).toEqual([5, 0]);

    expect(pipe1.type).toBe("pipe");
    expect(pipe2.type).toBe("pipe");
    expect((pipe1 as any).connections).toEqual([IDS.J1, IDS.J3]);
    expect((pipe2 as any).connections).toEqual([IDS.J3, IDS.J2]);
  });

  it("combines move and split operations for customer points", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6, CP1: 7, CP2: 8 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aNode(IDS.J3, [0, 10])
      .aNode(IDS.J4, [10, 10])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [3, 1],
        demand: 50,
        connection: {
          pipeId: IDS.P1,
          snapPoint: [3, 0],
          junctionId: IDS.J1,
        },
      })
      .aCustomerPoint(IDS.CP2, {
        coordinates: [0, 12],
        demand: 75,
        connection: {
          pipeId: IDS.P2,
          snapPoint: [0, 10],
          junctionId: IDS.J3,
        },
      })
      .build();

    const { putCustomerPoints } = moveNode(hydraulicModel, {
      nodeId: IDS.J3,
      newCoordinates: [5, 0],
      newElevation: 10,
      shouldUpdateCustomerPoints: true,
      pipeIdToSplit: IDS.P1,
    });

    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBeGreaterThan(0);

    const updatedCP1 = putCustomerPoints!.find(
      (cp) => cp.id === String(IDS.CP1),
    );
    const updatedCP2 = putCustomerPoints!.find(
      (cp) => cp.id === String(IDS.CP2),
    );

    expect(updatedCP1).toBeDefined();
    expect(updatedCP2).toBeDefined();
  });

  it("throws error for invalid pipeIdToSplit", () => {
    const IDS = { J1: 1 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .build();

    expect(() =>
      moveNode(hydraulicModel, {
        nodeId: IDS.J1,
        newCoordinates: [5, 0],
        newElevation: 10,
        pipeIdToSplit: 999,
      }),
    ).toThrow("Invalid pipe ID: 999");

    expect(() =>
      moveNode(hydraulicModel, {
        nodeId: IDS.J1,
        newCoordinates: [5, 0],
        newElevation: 10,
        pipeIdToSplit: IDS.J1,
      }),
    ).toThrow(`Invalid pipe ID: ${IDS.J1}`);
  });

  it("removes matching vertex when moving node to vertex location", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aNode(IDS.J3, [0, 10])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [5, 0],
          [10, 0],
        ],
      })
      .build();

    const { putAssets } = moveNode(hydraulicModel, {
      nodeId: IDS.J3,
      newCoordinates: [5, 0],
      newElevation: 10,
      pipeIdToSplit: IDS.P1,
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

  it("handles multiple vertices correctly when moving node", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [20, 0])
      .aNode(IDS.J3, [0, 10])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [5, 0],
          [10, 0],
          [15, 0],
          [20, 0],
        ],
      })
      .build();

    const { putAssets } = moveNode(hydraulicModel, {
      nodeId: IDS.J3,
      newCoordinates: [10, 0],
      newElevation: 10,
      pipeIdToSplit: IDS.P1,
    });

    const [movedNode, pipe1, pipe2] = putAssets!;

    expect(movedNode.id).toBe(IDS.J3);
    expect(movedNode.coordinates).toEqual([10, 0]);
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

  it("preserves customer point connections when moving with vertex snap", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, CP1: 5 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aNode(IDS.J3, [0, 10])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [5, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [3, 1],
        demand: 50,
        connection: {
          pipeId: IDS.P1,
          snapPoint: [3, 0],
          junctionId: IDS.J1,
        },
      })
      .build();

    const { putAssets, putCustomerPoints } = moveNode(hydraulicModel, {
      nodeId: IDS.J3,
      newCoordinates: [5, 0],
      newElevation: 10,
      pipeIdToSplit: IDS.P1,
      shouldUpdateCustomerPoints: true,
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

    expect(putCustomerPoints).toBeDefined();
    const updatedCP = putCustomerPoints!.find(
      (cp) => cp.id === String(IDS.CP1),
    );
    expect(updatedCP).toBeDefined();
    expect(updatedCP!.connection?.pipeId).toBe(pipe1.id);
  });
});
