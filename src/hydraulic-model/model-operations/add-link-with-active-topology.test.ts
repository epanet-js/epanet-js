import { describe, expect, it } from "vitest";
import { addLinkWithActiveTopology } from "./add-link-with-active-topology";
import {
  HydraulicModelBuilder,
  buildJunction,
  buildPump,
  buildCustomerPoint,
} from "../../__helpers__/hydraulic-model-builder";
import { Pump, Pipe, Junction } from "../asset-types";

describe("addLinkWithActiveTopology", () => {
  describe("basic functionality (no pipe splitting)", () => {
    it("updates connections", () => {
      const IDS = { A: 1, B: 2, pump: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [10, 10], id: IDS.A });
      const endNode = buildJunction({ coordinates: [30, 30], id: IDS.B });

      const link = buildPump({
        coordinates: [
          [10, 10],
          [20, 20],
          [30, 30],
        ],
        id: IDS.pump,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      expect(putAssets![0].id).toEqual(IDS.pump);
      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.connections).toEqual([IDS.A, IDS.B]);
      expect(pumpToCreate.coordinates).toEqual([
        [10, 10],
        [20, 20],
        [30, 30],
      ]);
    });

    it("removes redundant vertices", () => {
      const IDS = { A: 1, B: 2, pump: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [10, 10], id: IDS.A });
      const endNode = buildJunction({ coordinates: [30, 30], id: IDS.B });

      const link = buildPump({
        coordinates: [
          [10, 10],
          [20, 20],
          [20, 20],
          [25, 25],
          [25, 25 + 1e-10],
          [25 + 1e-10, 25],
          [30, 30],
          [30, 30],
        ],
        id: IDS.pump,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(IDS.pump);
      expect(pumpToCreate.coordinates).toEqual([
        [10, 10],
        [20, 20],
        [25, 25],
        [30, 30],
      ]);
    });

    it("ensures at least it has two points", () => {
      const IDS = { A: 1, B: 2, pump: 3 } as const;
      const epsilon = 1e-10;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [0, 1], id: IDS.A });
      const endNode = buildJunction({
        coordinates: [0, 1 + epsilon],
        id: IDS.B,
      });

      const link = buildPump({
        coordinates: [
          [0, 1],
          [0, 1 + 2 * epsilon],
          [0, 1 + 3 * epsilon],
        ],
        id: IDS.pump,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(IDS.pump);
      expect(pumpToCreate.coordinates).toEqual([
        [0, 1],
        [0, 1 + epsilon],
      ]);
    });

    it("ensures connectivity with the link endpoints", () => {
      const IDS = { pump: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [10, 10] });
      const endNode = buildJunction({ coordinates: [20, 20] });
      const link = buildPump({
        coordinates: [
          [10, 11],
          [15, 15],
          [19 + 1e-10, 20],
          [19, 20],
        ],
        id: IDS.pump,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(IDS.pump);
      expect(pumpToCreate.coordinates).toEqual([
        [10, 10],
        [15, 15],
        [19 + 1e-10, 20],
        [20, 20],
      ]);
    });

    it("calculates pump length", () => {
      const IDS = { pump: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startCoordinates = [-4.3760931, 55.9150083];
      const endCoordiantes = [-4.3771833, 55.9133641];
      const startNode = buildJunction({ coordinates: startCoordinates });
      const endNode = buildJunction({ coordinates: endCoordiantes });
      const link = buildPump({
        coordinates: [startCoordinates, endCoordiantes],
        id: IDS.pump,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(IDS.pump);
      expect(pumpToCreate.length).toBeCloseTo(195.04);
    });

    it("adds a label to the pump", () => {
      const IDS = { pump: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction();
      const endNode = buildJunction();
      const link = buildPump({
        id: IDS.pump,
        label: "",
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(IDS.pump);
      expect(pumpToCreate.label).toEqual("PU1");
    });

    it("adds a label to the nodes when missing", () => {
      const IDS = { pump: 1 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ label: "" });
      const endNode = buildJunction({ label: "CUSTOM" });
      const link = buildPump({
        id: IDS.pump,
        label: "",
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const [, nodeA, nodeB] = putAssets || [];
      expect(nodeA.label).toEqual("J1");
      expect(nodeB.label).toEqual("CUSTOM");
    });

    it("activates connected nodes when adding active link", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, pump: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [10, 10], isActive: true })
        .aJunction(IDS.J2, { coordinates: [30, 30], isActive: false })
        .aJunction(IDS.J3, { coordinates: [20, 20], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J3,
          isActive: false,
        })
        .build();

      const link = buildPump({
        coordinates: [
          [10, 10],
          [30, 30],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode: hydraulicModel.assets.get(IDS.J1)!.copy() as Junction,
        endNode: hydraulicModel.assets.get(IDS.J2)!.copy() as Junction,
        link,
      });

      const [, nodeA, nodeB] = putAssets || [];
      expect(nodeA.isActive).toBe(true);
      expect(nodeB.isActive).toBe(true);
    });

    it("activates new nodes when connecting to existing network with active link", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, pump: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const newStartNode = buildJunction({
        coordinates: [5, 5],
        id: IDS.J3,
      });
      const newEndNode = buildJunction({
        coordinates: [5, -5],
      });
      const link = buildPump({
        coordinates: [
          [5, 5],
          [5, -5],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode: newStartNode,
        endNode: newEndNode,
        link,
      });

      const [, startNode, endNode] = putAssets || [];
      expect(startNode.isActive).toBe(true);
      expect(endNode.isActive).toBe(true);
    });
  });

  describe("pipe splitting functionality", () => {
    it("splits start pipe when startPipeId provided", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, pump1: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const startNode = buildJunction({
        coordinates: [5, 0],
        id: IDS.J3,
      });
      const endNode = buildJunction({
        coordinates: [5, 5],
        id: IDS.J4,
      });
      const link = buildPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
        id: IDS.pump1,
      });

      const { putAssets, deleteAssets } = addLinkWithActiveTopology(
        hydraulicModel,
        {
          startNode,
          endNode,
          link,
          startPipeId: IDS.P1,
        },
      );

      expect(putAssets).toHaveLength(5);
      expect(deleteAssets).toEqual([IDS.P1]);

      const [newPump, , , splitPipe1, splitPipe2] = putAssets!;

      expect(newPump.type).toBe("pump");
      expect(newPump.id).toBe(IDS.pump1);
      expect((newPump as Pump).connections).toEqual([IDS.J3, IDS.J4]);

      expect(splitPipe1.type).toBe("pipe");
      expect(splitPipe2.type).toBe("pipe");
      expect((splitPipe1 as Pipe).connections).toEqual([IDS.J1, IDS.J3]);
      expect((splitPipe2 as Pipe).connections).toEqual([IDS.J3, IDS.J2]);
    });

    it("splits end pipe when endPipeId provided", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, pump1: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const startNode = buildJunction({
        coordinates: [5, 5],
        id: IDS.J3,
      });
      const endNode = buildJunction({
        coordinates: [5, 0],
        id: IDS.J4,
      });
      const link = buildPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
        id: IDS.pump1,
      });

      const { putAssets, deleteAssets } = addLinkWithActiveTopology(
        hydraulicModel,
        {
          startNode,
          endNode,
          link,
          endPipeId: IDS.P1,
        },
      );

      expect(putAssets).toHaveLength(5);
      expect(deleteAssets).toEqual([IDS.P1]);

      const [newPump, , , splitPipe1, splitPipe2] = putAssets!;

      expect(newPump.type).toBe("pump");
      expect((newPump as Pump).connections).toEqual([IDS.J3, IDS.J4]);

      expect((splitPipe1 as Pipe).connections).toEqual([IDS.J1, IDS.J4]);
      expect((splitPipe2 as Pipe).connections).toEqual([IDS.J4, IDS.J2]);
    });

    it("splits both start and end pipes", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 5,
        P2: 6,
        J5: 7,
        J6: 8,
        pump1: 9,
      } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aJunction(IDS.J3, { coordinates: [0, 10] })
        .aJunction(IDS.J4, { coordinates: [10, 10] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          coordinates: [
            [0, 10],
            [10, 10],
          ],
        })
        .build();

      const startNode = buildJunction({
        coordinates: [5, 0],
        id: IDS.J5,
      });
      const endNode = buildJunction({
        coordinates: [5, 10],
        id: IDS.J6,
      });
      const link = buildPump({
        coordinates: [
          [5, 0],
          [5, 10],
        ],
        id: IDS.pump1,
      });

      const { putAssets, deleteAssets } = addLinkWithActiveTopology(
        hydraulicModel,
        {
          startNode,
          endNode,
          link,
          startPipeId: IDS.P1,
          endPipeId: IDS.P2,
        },
      );

      expect(putAssets).toHaveLength(7);
      expect(deleteAssets).toEqual([IDS.P1, IDS.P2]);

      const [newPump, , , ...splitPipes] = putAssets!;

      expect(newPump.type).toBe("pump");
      expect((newPump as Pump).connections).toEqual([IDS.J5, IDS.J6]);
      expect(splitPipes).toHaveLength(4);
      expect(splitPipes.every((pipe) => pipe.type === "pipe")).toBe(true);
    });

    it("handles no pipe splitting (backward compatibility)", () => {
      const IDS = { A: 1, B: 2, pump: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [10, 10], id: IDS.A });
      const endNode = buildJunction({ coordinates: [30, 30], id: IDS.B });

      const link = buildPump({
        coordinates: [
          [10, 10],
          [30, 30],
        ],
        id: IDS.pump,
      });

      const { putAssets, deleteAssets } = addLinkWithActiveTopology(
        hydraulicModel,
        {
          startNode,
          endNode,
          link,
        },
      );

      expect(putAssets).toHaveLength(3);
      expect(deleteAssets).toBeUndefined();

      const [newPump] = putAssets!;
      expect(newPump.type).toBe("pump");
      expect((newPump as Pump).connections).toEqual([IDS.A, IDS.B]);
    });

    it("reconnects customer points when splitting start pipe", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 3,
        CP1: 4,
        J3: 5,
        J4: 6,
        pump1: 7,
      } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const customerPoint = buildCustomerPoint(IDS.CP1, {
        coordinates: [3, 1],
        demand: 85,
      });

      customerPoint.connect({
        pipeId: IDS.P1,
        snapPoint: [3, 0],
        junctionId: IDS.J1,
      });

      hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint);

      const startNode = buildJunction({
        coordinates: [5, 0],
        id: IDS.J3,
      });
      const endNode = buildJunction({
        coordinates: [5, 5],
        id: IDS.J4,
      });
      const link = buildPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
        id: IDS.pump1,
      });

      const { putAssets, putCustomerPoints } = addLinkWithActiveTopology(
        hydraulicModel,
        {
          startNode,
          endNode,
          link,
          startPipeId: IDS.P1,
        },
      );

      expect(putAssets).toHaveLength(5);
      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints).toHaveLength(1);

      const reconnectedCP = putCustomerPoints![0];
      const splitPipes = putAssets!.filter(
        (asset) => asset.type === "pipe",
      ) as Pipe[];

      expect(reconnectedCP.connection?.pipeId).toBe(splitPipes[0].id);
      expect(reconnectedCP.baseDemand).toBe(85);
      expect(reconnectedCP.coordinates).toEqual([3, 1]);
    });

    it("reconnects customer points when splitting end pipe", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 3,
        CP1: 4,
        J3: 5,
        J4: 6,
        pump1: 7,
      } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const customerPoint = buildCustomerPoint(IDS.CP1, {
        coordinates: [7, 1],
        demand: 90,
      });

      customerPoint.connect({
        pipeId: IDS.P1,
        snapPoint: [7, 0],
        junctionId: IDS.J2,
      });

      hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint);

      const startNode = buildJunction({
        coordinates: [5, 5],
        id: IDS.J3,
      });
      const endNode = buildJunction({
        coordinates: [5, 0],
        id: IDS.J4,
      });
      const link = buildPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
        id: IDS.pump1,
      });

      const { putAssets, putCustomerPoints } = addLinkWithActiveTopology(
        hydraulicModel,
        {
          startNode,
          endNode,
          link,
          endPipeId: IDS.P1,
        },
      );

      expect(putAssets).toHaveLength(5);
      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints).toHaveLength(1);

      const reconnectedCP = putCustomerPoints![0];

      expect(reconnectedCP.baseDemand).toBe(90);
      expect(reconnectedCP.coordinates).toEqual([7, 1]);
      expect(reconnectedCP.connection?.snapPoint).toEqual([7, 0]);
    });

    it("reconnects customer points when splitting both pipes", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 5,
        P2: 6,
        CP1: 7,
        CP2: 8,
        J5: 9,
        J6: 10,
        pump1: 11,
      } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aJunction(IDS.J3, { coordinates: [0, 10] })
        .aJunction(IDS.J4, { coordinates: [10, 10] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          coordinates: [
            [0, 10],
            [10, 10],
          ],
        })
        .build();

      const customerPoint1 = buildCustomerPoint(IDS.CP1, {
        coordinates: [3, 1],
        demand: 60,
      });
      const customerPoint2 = buildCustomerPoint(IDS.CP2, {
        coordinates: [7, 11],
        demand: 80,
      });

      customerPoint1.connect({
        pipeId: IDS.P1,
        snapPoint: [3, 0],
        junctionId: IDS.J1,
      });
      customerPoint2.connect({
        pipeId: IDS.P2,
        snapPoint: [7, 10],
        junctionId: IDS.J4,
      });

      hydraulicModel.customerPoints.set(customerPoint1.id, customerPoint1);
      hydraulicModel.customerPoints.set(customerPoint2.id, customerPoint2);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint1);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint2);

      const startNode = buildJunction({
        coordinates: [5, 0],
        id: IDS.J5,
      });
      const endNode = buildJunction({
        coordinates: [5, 10],
        id: IDS.J6,
      });
      const link = buildPump({
        coordinates: [
          [5, 0],
          [5, 10],
        ],
        id: IDS.pump1,
      });

      const { putAssets, putCustomerPoints } = addLinkWithActiveTopology(
        hydraulicModel,
        {
          startNode,
          endNode,
          link,
          startPipeId: IDS.P1,
          endPipeId: IDS.P2,
        },
      );

      expect(putAssets).toHaveLength(7);
      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints).toHaveLength(2);

      const cp1Reconnected = putCustomerPoints!.find((cp) => cp.id === IDS.CP1);
      const cp2Reconnected = putCustomerPoints!.find((cp) => cp.id === IDS.CP2);

      expect(cp1Reconnected?.baseDemand).toBe(60);
      expect(cp2Reconnected?.baseDemand).toBe(80);
      expect(cp1Reconnected?.coordinates).toEqual([3, 1]);
      expect(cp2Reconnected?.coordinates).toEqual([7, 11]);
    });

    it("throws error for invalid startPipeId", () => {
      const IDS = { J3: 1, J4: 2, pump1: 3, NONEXISTENT: 999 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [5, 0], id: IDS.J3 });
      const endNode = buildJunction({ coordinates: [5, 5], id: IDS.J4 });
      const link = buildPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
        id: IDS.pump1,
      });

      expect(() => {
        addLinkWithActiveTopology(hydraulicModel, {
          startNode,
          endNode,
          link,
          startPipeId: IDS.NONEXISTENT,
        });
      }).toThrow("Start pipe not found: 999 (asset does not exist)");
    });

    it("throws error for invalid endPipeId", () => {
      const IDS = { J3: 1, J4: 2, pump1: 3, NONEXISTENT: 999 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [5, 5], id: IDS.J3 });
      const endNode = buildJunction({ coordinates: [5, 0], id: IDS.J4 });
      const link = buildPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
        id: IDS.pump1,
      });

      expect(() => {
        addLinkWithActiveTopology(hydraulicModel, {
          startNode,
          endNode,
          link,
          endPipeId: IDS.NONEXISTENT,
        });
      }).toThrow("End pipe not found: 999 (asset does not exist)");
    });
  });

  it("splits both pipes when connecting vertices on different pipes", () => {
    const IDS = {
      J1: 1,
      J2: 2,
      P1: 3,
      J3: 4,
      J4: 5,
      P2: 6,
      J_START: 7,
      J_END: 8,
      PUMP1: 9,
    } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [20, 0])
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
          [20, 0],
        ],
      })
      .aNode(IDS.J3, [10, 10])
      .aNode(IDS.J4, [10, 30])
      .aPipe(IDS.P2, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
        coordinates: [
          [10, 10],
          [10, 20],
          [10, 30],
        ],
      })
      .build();

    const startNode = buildJunction({ coordinates: [10, 0], id: IDS.J_START });
    const endNode = buildJunction({ coordinates: [10, 20], id: IDS.J_END });
    const link = buildPump({
      coordinates: [
        [10, 0],
        [10, 20],
      ],
      id: IDS.PUMP1,
    });

    const { putAssets, deleteAssets } = addLinkWithActiveTopology(
      hydraulicModel,
      {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P2,
      },
    );

    expect(deleteAssets).toEqual([IDS.P1, IDS.P2]);

    const pipes = putAssets!.filter((asset) => asset.type === "pipe") as Pipe[];
    expect(pipes).toHaveLength(4);

    const p1Segments = pipes.filter((p) => p.label.startsWith("P1"));
    const p2Segments = pipes.filter((p) => p.label.startsWith("P2"));

    expect(p1Segments).toHaveLength(2);
    expect(p2Segments).toHaveLength(2);

    const p1Seg1 = p1Segments.find((p) => p.connections[0] === IDS.J1);
    const p1Seg2 = p1Segments.find((p) => p.connections[1] === IDS.J2);

    expect(p1Seg1?.coordinates).toEqual([
      [0, 0],
      [10, 0],
    ]);
    expect(p1Seg2?.coordinates).toEqual([
      [10, 0],
      [20, 0],
    ]);

    const p2Seg1 = p2Segments.find((p) => p.connections[0] === IDS.J3);
    const p2Seg2 = p2Segments.find((p) => p.connections[1] === IDS.J4);

    expect(p2Seg1?.coordinates).toEqual([
      [10, 10],
      [10, 20],
    ]);
    expect(p2Seg2?.coordinates).toEqual([
      [10, 20],
      [10, 30],
    ]);
  });

  describe("isActive inference logic", () => {
    it("infers isActive: false when both endpoints are existing inactive nodes", () => {
      const IDS = { J1: 1, J2: 2, pump: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .build();

      const startNode = hydraulicModel.assets.get(IDS.J1)!.copy() as Junction;
      const endNode = hydraulicModel.assets.get(IDS.J2)!.copy() as Junction;
      const link = buildPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const [newPump, nodeA, nodeB] = putAssets || [];
      expect(newPump.isActive).toBe(false);
      expect(nodeA.isActive).toBe(false);
      expect(nodeB.isActive).toBe(false);
    });

    it("infers isActive: false when both endpoints split inactive pipes", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 5,
        P2: 6,
        J5: 7,
        J6: 8,
        pump: 9,
      } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [20, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [20, 0],
          ],
          isActive: false,
        })
        .aJunction(IDS.J3, { coordinates: [0, 10], isActive: false })
        .aJunction(IDS.J4, { coordinates: [20, 10], isActive: false })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          coordinates: [
            [0, 10],
            [20, 10],
          ],
          isActive: false,
        })
        .build();

      const startNode = buildJunction({
        coordinates: [10, 0],
        id: IDS.J5,
      });
      const endNode = buildJunction({
        coordinates: [10, 10],
        id: IDS.J6,
      });
      const link = buildPump({
        coordinates: [
          [10, 0],
          [10, 10],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P2,
      });

      const [newPump, nodeStart, nodeEnd] = putAssets || [];
      expect(newPump.isActive).toBe(false);
      expect(nodeStart.isActive).toBe(false);
      expect(nodeEnd.isActive).toBe(false);
    });

    it("infers isActive: false when one endpoint is existing inactive and other is new isolated", () => {
      const IDS = { J1: 1, J2: 2, pump: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .build();

      const startNode = hydraulicModel.assets.get(IDS.J1)!.copy() as Junction;
      const endNode = buildJunction({
        coordinates: [10, 0],
        id: IDS.J2,
      });
      const link = buildPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const [newPump, nodeA, nodeB] = putAssets || [];
      expect(newPump.isActive).toBe(false);
      expect(nodeA.isActive).toBe(false);
      expect(nodeB.isActive).toBe(false);
    });

    it("infers isActive: false when one endpoint is existing inactive and other splits inactive pipe", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, J4: 5, pump: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [0, 10] })
        .aJunction(IDS.J3, { coordinates: [0, 20] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J2,
          endNodeId: IDS.J3,
          coordinates: [
            [0, 10],
            [0, 20],
          ],
          isActive: false,
        })
        .build();

      const startNode = hydraulicModel.assets.get(IDS.J1)!.copy() as Junction;
      const endNode = buildJunction({
        coordinates: [0, 15],
        id: IDS.J4,
      });
      const link = buildPump({
        coordinates: [
          [0, 0],
          [0, 15],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
        endPipeId: IDS.P1,
      });

      const [newPump, nodeStart, nodeEnd] = putAssets || [];
      expect(newPump.isActive).toBe(false);
      expect(nodeStart.isActive).toBe(false);
      expect(nodeEnd.isActive).toBe(false);
    });

    it("infers isActive: false when one endpoint splits inactive pipe and other is new isolated", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, pump: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [20, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [20, 0],
          ],
          isActive: false,
        })
        .build();

      const startNode = buildJunction({
        coordinates: [10, 0],
        id: IDS.J3,
      });
      const endNode = buildJunction({
        coordinates: [10, 10],
        id: IDS.J4,
      });
      const link = buildPump({
        coordinates: [
          [10, 0],
          [10, 10],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
      });

      const [newPump, nodeStart, nodeEnd] = putAssets || [];
      expect(newPump.isActive).toBe(false);
      expect(nodeStart.isActive).toBe(false);
      expect(nodeEnd.isActive).toBe(false);
    });

    it("keeps isActive: true when both endpoints are new isolated nodes (starting new network)", () => {
      const IDS = { J1: 1, J2: 2, pump: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();

      const startNode = buildJunction({
        coordinates: [0, 0],
        id: IDS.J1,
      });
      const endNode = buildJunction({
        coordinates: [10, 0],
        id: IDS.J2,
      });
      const link = buildPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const [newPump, nodeA, nodeB] = putAssets || [];
      expect(newPump.isActive).toBe(true);
      expect(nodeA.isActive).toBe(true);
      expect(nodeB.isActive).toBe(true);
    });

    it("keeps isActive: true when one endpoint is active", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, pump: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: true })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aJunction(IDS.J3, { coordinates: [20.0], isActive: true })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
        .build();

      const startNode = hydraulicModel.assets.get(IDS.J1)?.copy() as Junction;
      const endNode = hydraulicModel.assets.get(IDS.J2)?.copy() as Junction;
      const link = buildPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const [newPump, nodeA, nodeB] = putAssets || [];
      expect(newPump.isActive).toBe(true);
      expect(nodeA.isActive).toBe(true);
      expect(nodeB.isActive).toBe(true);
    });

    it("keeps isActive: true when splitting an active pipe", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, J4: 5, pump: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [0, 10] })
        .aJunction(IDS.J3, { coordinates: [0, 20] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J2,
          endNodeId: IDS.J3,
          coordinates: [
            [0, 10],
            [0, 20],
          ],
          isActive: true,
        })
        .build();

      const startNode = hydraulicModel.assets.get(IDS.J1)!.copy() as Junction;
      const endNode = buildJunction({
        coordinates: [0, 15],
        id: IDS.J4,
      });
      const link = buildPump({
        coordinates: [
          [0, 0],
          [0, 15],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLinkWithActiveTopology(hydraulicModel, {
        startNode,
        endNode,
        link,
        endPipeId: IDS.P1,
      });

      const [newPump, nodeStart, nodeEnd] = putAssets || [];
      expect(newPump.isActive).toBe(true);
      expect(nodeStart.isActive).toBe(true);
      expect(nodeEnd.isActive).toBe(true);
    });
  });
});
