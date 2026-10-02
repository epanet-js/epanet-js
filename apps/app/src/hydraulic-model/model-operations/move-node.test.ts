import { describe, expect, it } from "vitest";
import { moveNode, moveNodeAndLinks } from "./move-node";

import type {
  AssetId,
  CustomerPoint,
  LinkAsset,
  NodeAsset,
  Pipe,
} from "@epanet-js/hydraulic-model";
import type { Position } from "geojson";
import type { ChangeSet } from "@epanet-js/change-set";
import type { HydraulicModel } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "../../__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";

const setUp = () => {
  const factories = buildTestFactories();
  const builder = HydraulicModelBuilder.with(factories);
  return { ...factories, builder };
};

const move = (
  model: HydraulicModel,
  { assetFactory, labelManager }: ReturnType<typeof buildTestFactories>,
  data: {
    nodeId: AssetId;
    newCoordinates: Position;
    newElevation: number | null;
    shouldUpdateCustomerPoints?: boolean;
    pipeIdToSplit?: AssetId;
  },
) => {
  const changeSet = moveNode(model, {
    ...data,
    lengthUnit: "m",
    assetFactory,
    labelManager,
  });
  applyOperation(model, changeSet, labelManager);
  return changeSet;
};

const changedEntities = (changeSet: ChangeSet) =>
  changeSet
    .summary()
    .map(({ entity, kind, count }) => `${entity}:${kind}:${count}`)
    .sort();

const nodeOf = (model: HydraulicModel, nodeId: AssetId) =>
  model.assets.get(nodeId) as NodeAsset;

const linkOf = (model: HydraulicModel, linkId: AssetId) =>
  model.assets.get(linkId) as LinkAsset;

const customerPointOf = (model: HydraulicModel, id: number) =>
  model.customerPoints.get(id) as CustomerPoint;

const pipeBetween = (
  model: HydraulicModel,
  changeSet: ChangeSet,
  startNodeId: AssetId,
  endNodeId: AssetId,
) => {
  for (const entry of changeSet.entries()) {
    if (entry.kind !== "create" || entry.entity !== "pipe") continue;
    const pipe = model.assets.get(entry.id as AssetId) as Pipe;
    if (
      pipe.connections[0] === startNodeId &&
      pipe.connections[1] === endNodeId
    ) {
      return pipe;
    }
  }
  throw new Error(`No pipe from ${startNodeId} to ${endNodeId}`);
};

describe("moveNode", () => {
  it("updates the coordinates of a node", () => {
    const IDS = { A: 1 };
    const { builder, ...factories } = setUp();
    const model = builder.aNode(IDS.A, [10, 10]).build();

    const changeSet = move(model, factories, {
      nodeId: IDS.A,
      newCoordinates: [20, 20],
      newElevation: 10,
    });

    expect(changeSet.name).toBe("moveNode");
    expect(changedEntities(changeSet)).toEqual(["junction:update:1"]);

    const movedNode = nodeOf(model, IDS.A);
    expect(movedNode.coordinates).toEqual([20, 20]);
    expect(movedNode.elevation).toEqual(10);
  });

  it("updates the connected links", () => {
    const IDS = { A: 1, B: 2, C: 3, AB: 4, BC: 5 };
    const { builder, ...factories } = setUp();
    const model = builder
      .aNode(IDS.A, [10, 10])
      .aNode(IDS.B, [20, 20])
      .aNode(IDS.C, [30, 30])
      .aLink(IDS.AB, IDS.A, IDS.B, { length: 1 })
      .aLink(IDS.BC, IDS.B, IDS.C, { length: 2 })
      .build();

    const newCoordinates = [25, 25];

    const changeSet = move(model, factories, {
      nodeId: IDS.B,
      newCoordinates,
      newElevation: 10,
    });

    expect(changedEntities(changeSet)).toEqual([
      "junction:update:1",
      "pipe:update:2",
    ]);
    expect(nodeOf(model, IDS.B).coordinates).toEqual(newCoordinates);
    expect(linkOf(model, IDS.AB).coordinates).toEqual([
      [10, 10],
      newCoordinates,
    ]);
    expect(linkOf(model, IDS.BC).coordinates).toEqual([
      newCoordinates,
      [30, 30],
    ]);
  });

  describe("customer points", () => {
    it("updates customer point snap points when updateCustomerPoints is true", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.J1, [10, 10])
        .aNode(IDS.J2, [30, 10])
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [20, 15],
          connection: {
            pipeId: IDS.P1,
            snapPoint: [20, 10],
            junctionId: IDS.J1,
          },
        })
        .build();

      const changeSet = move(model, factories, {
        nodeId: IDS.J1,
        newCoordinates: [10, 20],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(changedEntities(changeSet)).toContain("customerPoint:update:1");
      expect(customerPointOf(model, IDS.CP1).connection!.snapPoint).not.toEqual(
        [20, 10],
      );
    });

    it("does not update customer points when updateCustomerPoints is false", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.J1, [10, 10])
        .aNode(IDS.J2, [30, 10])
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [20, 15],
          connection: {
            pipeId: IDS.P1,
            snapPoint: [20, 10],
            junctionId: IDS.J1,
          },
        })
        .build();

      const changeSet = move(model, factories, {
        nodeId: IDS.J1,
        newCoordinates: [10, 20],
        newElevation: 10,
        shouldUpdateCustomerPoints: false,
      });

      expect(changedEntities(changeSet)).not.toContain(
        "customerPoint:update:1",
      );
      expect(customerPointOf(model, IDS.CP1).connection!.snapPoint).toEqual([
        20, 10,
      ]);
    });

    it("skips customer points when none are connected to affected pipes", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.J1, [10, 10])
        .aNode(IDS.J2, [30, 10])
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const changeSet = move(model, factories, {
        nodeId: IDS.J1,
        newCoordinates: [15, 20],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:update:1",
        "pipe:update:1",
      ]);
    });

    it("reallocates customer point to new junction when node move changes closest endpoint", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [20, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [5, 0],
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [5, 0],
          },
        })
        .build();

      move(model, factories, {
        nodeId: IDS.J1,
        newCoordinates: [25, 0],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(customerPointOf(model, IDS.CP1).connection!.junctionId).toEqual(
        IDS.J2,
      );
    });

    it("updates junction assignments when customer point stays with same junction", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [20, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [2, 0],
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [2, 0],
          },
        })
        .build();

      move(model, factories, {
        nodeId: IDS.J1,
        newCoordinates: [0, 5],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      const updatedCustomerPoint = customerPointOf(model, IDS.CP1);
      expect(updatedCustomerPoint.connection!.junctionId).toEqual(IDS.J1);
      expect(updatedCustomerPoint.connection!.snapPoint).not.toEqual([2, 0]);
    });

    it("handles multiple customer points on same pipe with different junction assignments", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [30, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [5, 0],
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [5, 0],
          },
        })
        .aCustomerPoint(IDS.CP2, {
          coordinates: [25, 0],
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J2,
            snapPoint: [25, 0],
          },
        })
        .build();

      move(model, factories, {
        nodeId: IDS.J1,
        newCoordinates: [35, 0],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(customerPointOf(model, IDS.CP1).connection!.junctionId).toEqual(
        IDS.J2,
      );
      expect(customerPointOf(model, IDS.CP2).connection!.junctionId).toEqual(
        IDS.J2,
      );
    });

    it("assigns customer to correct junction after moving node with updated coordinates", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aJunction(IDS.J1, { coordinates: [-122.415, 37.7749] })
        .aJunction(IDS.J2, { coordinates: [-122.41, 37.7749] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [-122.414, 37.775],
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [-122.414, 37.7749],
          },
        })
        .build();

      move(model, factories, {
        nodeId: IDS.J1,
        newCoordinates: [-122.405, 37.7749],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(customerPointOf(model, IDS.CP1).connection!.junctionId).toEqual(
        IDS.J2,
      );
    });
  });

  it("splits pipe and connects moved node when pipeIdToSplit provided", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const { builder, ...factories } = setUp();
    const model = builder
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aNode(IDS.J3, [0, 10])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const changeSet = move(model, factories, {
      nodeId: IDS.J3,
      newCoordinates: [5, 0],
      newElevation: 10,
      pipeIdToSplit: IDS.P1,
    });

    expect(changeSet.name).toBe("moveNode");
    expect(changedEntities(changeSet)).toEqual([
      "junction:update:1",
      "pipe:create:2",
      "pipe:delete:1",
    ]);
    expect(model.assets.has(IDS.P1)).toBe(false);
    expect(nodeOf(model, IDS.J3).coordinates).toEqual([5, 0]);

    const pipe1 = pipeBetween(model, changeSet, IDS.J1, IDS.J3);
    const pipe2 = pipeBetween(model, changeSet, IDS.J3, IDS.J2);
    expect(model.topology.getNodes(pipe1.id)).toEqual([IDS.J1, IDS.J3]);
    expect(model.topology.getNodes(pipe2.id)).toEqual([IDS.J3, IDS.J2]);
  });

  it("combines move and split operations for customer points", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6, CP1: 7, CP2: 8 };
    const { builder, ...factories } = setUp();
    const model = builder
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
      .aNode(IDS.J3, [0, 10])
      .aNode(IDS.J4, [10, 10])
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [3, 1],
        connection: {
          pipeId: IDS.P1,
          snapPoint: [3, 0],
          junctionId: IDS.J1,
        },
      })
      .aCustomerPoint(IDS.CP2, {
        coordinates: [0, 12],
        connection: {
          pipeId: IDS.P2,
          snapPoint: [0, 10],
          junctionId: IDS.J3,
        },
      })
      .build();

    const changeSet = move(model, factories, {
      nodeId: IDS.J3,
      newCoordinates: [5, 0],
      newElevation: 10,
      shouldUpdateCustomerPoints: true,
      pipeIdToSplit: IDS.P1,
    });

    expect(changedEntities(changeSet)).toContain("customerPoint:update:2");

    const pipe1 = pipeBetween(model, changeSet, IDS.J1, IDS.J3);
    expect(customerPointOf(model, IDS.CP1).connection!.pipeId).toBe(pipe1.id);
    expect(customerPointOf(model, IDS.CP2).connection!.pipeId).toBe(IDS.P2);
    expect(customerPointOf(model, IDS.CP2).connection!.snapPoint).not.toEqual([
      0, 10,
    ]);
  });

  describe("active topology", () => {
    it("activates an inactive node when it splits an active pipe", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aJunction(IDS.J3, { coordinates: [0, 10], isActive: false })
        .aJunction(IDS.J4, { coordinates: [5, 10], isActive: false })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          isActive: false,
        })
        .build();

      move(model, factories, {
        nodeId: IDS.J4,
        newCoordinates: [5, 0],
        newElevation: 10,
        pipeIdToSplit: IDS.P1,
      });

      expect(nodeOf(model, IDS.J4).isActive).toBe(true);
      expect(linkOf(model, IDS.P2).isActive).toBe(false);
    });

    it("keeps an active node active when it splits an inactive pipe", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aJunction(IDS.J3, { coordinates: [0, 10] })
        .aJunction(IDS.J4, { coordinates: [5, 10] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J4 })
        .build();

      move(model, factories, {
        nodeId: IDS.J4,
        newCoordinates: [5, 0],
        newElevation: 10,
        pipeIdToSplit: IDS.P1,
      });

      expect(nodeOf(model, IDS.J4).isActive).toBe(true);
    });

    it("deactivates a node when both its links and the split pipe are inactive", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
      const { builder, ...factories } = setUp();
      const model = builder
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aJunction(IDS.J3, { coordinates: [0, 10], isActive: false })
        .aJunction(IDS.J4, { coordinates: [5, 10] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          isActive: false,
        })
        .build();

      move(model, factories, {
        nodeId: IDS.J4,
        newCoordinates: [5, 0],
        newElevation: 10,
        pipeIdToSplit: IDS.P1,
      });

      expect(nodeOf(model, IDS.J4).isActive).toBe(false);
    });
  });

  it("throws error for invalid pipeIdToSplit", () => {
    const IDS = { J1: 1 };
    const { builder, ...factories } = setUp();
    const model = builder.aNode(IDS.J1, [0, 0]).build();

    expect(() =>
      move(model, factories, {
        nodeId: IDS.J1,
        newCoordinates: [5, 0],
        newElevation: 10,
        pipeIdToSplit: 999,
      }),
    ).toThrow("Invalid pipe ID: 999");

    expect(() =>
      move(model, factories, {
        nodeId: IDS.J1,
        newCoordinates: [5, 0],
        newElevation: 10,
        pipeIdToSplit: IDS.J1,
      }),
    ).toThrow(`Invalid pipe ID: ${IDS.J1}`);
  });

  it("removes matching vertex when moving node to vertex location", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const { builder, ...factories } = setUp();
    const model = builder
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

    const changeSet = move(model, factories, {
      nodeId: IDS.J3,
      newCoordinates: [5, 0],
      newElevation: 10,
      pipeIdToSplit: IDS.P1,
    });

    expect(pipeBetween(model, changeSet, IDS.J1, IDS.J3).coordinates).toEqual([
      [0, 0],
      [5, 0],
    ]);
    expect(pipeBetween(model, changeSet, IDS.J3, IDS.J2).coordinates).toEqual([
      [5, 0],
      [10, 0],
    ]);
  });

  it("handles multiple vertices correctly when moving node", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const { builder, ...factories } = setUp();
    const model = builder
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

    const changeSet = move(model, factories, {
      nodeId: IDS.J3,
      newCoordinates: [10, 0],
      newElevation: 10,
      pipeIdToSplit: IDS.P1,
    });

    expect(nodeOf(model, IDS.J3).coordinates).toEqual([10, 0]);
    expect(pipeBetween(model, changeSet, IDS.J1, IDS.J3).coordinates).toEqual([
      [0, 0],
      [5, 0],
      [10, 0],
    ]);
    expect(pipeBetween(model, changeSet, IDS.J3, IDS.J2).coordinates).toEqual([
      [10, 0],
      [15, 0],
      [20, 0],
    ]);
  });

  it("preserves customer point connections when moving with vertex snap", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, CP1: 5 };
    const { builder, ...factories } = setUp();
    const model = builder
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
        connection: {
          pipeId: IDS.P1,
          snapPoint: [3, 0],
          junctionId: IDS.J1,
        },
      })
      .build();

    const changeSet = move(model, factories, {
      nodeId: IDS.J3,
      newCoordinates: [5, 0],
      newElevation: 10,
      pipeIdToSplit: IDS.P1,
      shouldUpdateCustomerPoints: true,
    });

    const pipe1 = pipeBetween(model, changeSet, IDS.J1, IDS.J3);
    expect(pipe1.coordinates).toEqual([
      [0, 0],
      [5, 0],
    ]);
    expect(customerPointOf(model, IDS.CP1).connection?.pipeId).toBe(pipe1.id);
  });
});

describe("moveNodeAndLinks", () => {
  it("returns the moved node and its links without touching the model", () => {
    const IDS = { A: 1, B: 2, C: 3, AB: 4, BC: 5 };
    const { builder } = setUp();
    const model = builder
      .aNode(IDS.A, [10, 10])
      .aNode(IDS.B, [20, 20])
      .aNode(IDS.C, [30, 30])
      .aLink(IDS.AB, IDS.A, IDS.B)
      .aLink(IDS.BC, IDS.B, IDS.C)
      .build();

    const { node, links } = moveNodeAndLinks(model, {
      nodeId: IDS.B,
      newCoordinates: [25, 25],
      newElevation: 10,
      lengthUnit: "m",
    });

    expect(node.id).toBe(IDS.B);
    expect(node.coordinates).toEqual([25, 25]);
    expect(links.map((link) => link.id).sort()).toEqual([IDS.AB, IDS.BC]);
    expect(links.find((link) => link.id === IDS.AB)!.coordinates).toEqual([
      [10, 10],
      [25, 25],
    ]);
    expect(nodeOf(model, IDS.B).coordinates).toEqual([20, 20]);
    expect(linkOf(model, IDS.AB).coordinates).toEqual([
      [10, 10],
      [20, 20],
    ]);
  });
});
