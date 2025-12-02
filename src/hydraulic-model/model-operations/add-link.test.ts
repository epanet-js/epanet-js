import { describe, expect, it } from "vitest";
import { addLink } from "./add-link";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "../../__helpers__/hydraulic-model-builder";
import { Pump, Pipe, Junction, Valve } from "../asset-types";

describe("addLink", () => {
  describe("basic functionality (no pipe splitting)", () => {
    it("updates connections", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 10],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [30, 30],
      });

      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [10, 10],
          [20, 20],
          [30, 30],
        ],
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      expect(putAssets![0].id).toEqual(link.id);
      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.connections).toEqual([startNode.id, endNode.id]);
      expect(pumpToCreate.coordinates).toEqual([
        [10, 10],
        [20, 20],
        [30, 30],
      ]);
    });

    it("removes redundant vertices", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 10],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [30, 30],
      });

      const link = hydraulicModel.assetBuilder.buildPump({
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
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(link.id);
      expect(pumpToCreate.coordinates).toEqual([
        [10, 10],
        [20, 20],
        [25, 25],
        [30, 30],
      ]);
    });

    it("ensures at least it has two points", () => {
      const epsilon = 1e-10;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [0, 1],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [0, 1 + epsilon],
      });

      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [0, 1],
          [0, 1 + 2 * epsilon],
          [0, 1 + 3 * epsilon],
        ],
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(link.id);
      expect(pumpToCreate.coordinates).toEqual([
        [0, 1],
        [0, 1 + epsilon],
      ]);
    });

    it("ensures connectivity with the link endpoints", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 10],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [20, 20],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [10, 11],
          [15, 15],
          [19 + 1e-10, 20],
          [19, 20],
        ],
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(link.id);
      expect(pumpToCreate.coordinates).toEqual([
        [10, 10],
        [15, 15],
        [19 + 1e-10, 20],
        [20, 20],
      ]);
    });

    it("calculates pump length", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startCoordinates = [-4.3760931, 55.9150083];
      const endCoordiantes = [-4.3771833, 55.9133641];
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: startCoordinates,
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: endCoordiantes,
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [startCoordinates, endCoordiantes],
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(link.id);
      expect(pumpToCreate.length).toBeCloseTo(195.04);
    });

    it("adds a label to the pump", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction();
      const endNode = hydraulicModel.assetBuilder.buildJunction();
      const link = hydraulicModel.assetBuilder.buildPump({
        label: "",
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual(link.id);
      expect(pumpToCreate.label).toEqual("PU1");
    });

    it("creates a default curve when adding a pump", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 10],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [30, 30],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [10, 10],
          [30, 30],
        ],
      });

      const { putCurves } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      expect(putCurves).toHaveLength(1);
      expect(putCurves![0]).toEqual({
        id: String(link.id),
        type: "pump",
        points: [{ x: 1, y: 1 }],
      });
    });

    it("does not create a curve when adding a pipe", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 10],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [30, 30],
      });
      const link = hydraulicModel.assetBuilder.buildPipe({
        coordinates: [
          [10, 10],
          [30, 30],
        ],
      });

      const { putCurves } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      expect(putCurves).toBeUndefined();
    });

    it("adds a label to the nodes when missing", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        label: "",
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        label: "CUSTOM",
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        label: "",
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const [, nodeA, nodeB] = putAssets || [];
      expect(nodeA.label).toEqual("J1");
      expect(nodeB.label).toEqual("CUSTOM");
    });
  });

  describe("pipe splitting functionality", () => {
    it("splits start pipe when startPipeId provided", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
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

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 5],
      });
      const pump = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link: pump,
        startPipeId: IDS.P1,
      });

      expect(putAssets).toHaveLength(5);
      expect(deleteAssets).toEqual([IDS.P1]);

      const [newPump, , , splitPipe1, splitPipe2] = putAssets!;

      expect(newPump.type).toBe("pump");
      expect(newPump.id).toBe(pump.id);
      expect((newPump as Pump).connections).toEqual([startNode.id, endNode.id]);

      expect(splitPipe1.type).toBe("pipe");
      expect(splitPipe2.type).toBe("pipe");
      expect((splitPipe1 as Pipe).connections).toEqual([IDS.J1, startNode.id]);
      expect((splitPipe2 as Pipe).connections).toEqual([startNode.id, IDS.J2]);
    });

    it("splits end pipe when endPipeId provided", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
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

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 5],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        endPipeId: IDS.P1,
      });

      expect(putAssets).toHaveLength(5);
      expect(deleteAssets).toEqual([IDS.P1]);

      const [newPump, , , splitPipe1, splitPipe2] = putAssets!;

      expect(newPump.type).toBe("pump");
      expect((newPump as Pump).connections).toEqual([startNode.id, endNode.id]);

      expect((splitPipe1 as Pipe).connections).toEqual([IDS.J1, endNode.id]);
      expect((splitPipe2 as Pipe).connections).toEqual([endNode.id, IDS.J2]);
    });

    it("splits both start and end pipes", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 5,
        P2: 6,
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

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 10],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [5, 0],
          [5, 10],
        ],
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P2,
      });

      expect(putAssets).toHaveLength(7);
      expect(deleteAssets).toEqual([IDS.P1, IDS.P2]);

      const [newPump, , , ...splitPipes] = putAssets!;

      expect(newPump.type).toBe("pump");
      expect((newPump as Pump).connections).toEqual([startNode.id, endNode.id]);
      expect(splitPipes).toHaveLength(4);
      expect(splitPipes.every((pipe) => pipe.type === "pipe")).toBe(true);
    });

    it("handles no pipe splitting (backward compatibility)", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 10],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [30, 30],
      });

      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [10, 10],
          [30, 30],
        ],
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      expect(putAssets).toHaveLength(3);
      expect(deleteAssets).toBeUndefined();

      const [newPump] = putAssets!;
      expect(newPump.type).toBe("pump");
      expect((newPump as Pump).connections).toEqual([startNode.id, endNode.id]);
    });

    it("reconnects customer points when splitting start pipe", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 3,
        CP1: 4,
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

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 5],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
      });

      const { putAssets, putCustomerPoints } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
      });

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

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 5],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
      });

      const { putAssets, putCustomerPoints } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        endPipeId: IDS.P1,
      });

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

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 10],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [5, 0],
          [5, 10],
        ],
      });

      const { putAssets, putCustomerPoints } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P2,
      });

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
      const IDS = { NONEXISTENT: 999 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 5],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
      });

      expect(() => {
        addLink(hydraulicModel, {
          startNode,
          endNode,
          link,
          startPipeId: IDS.NONEXISTENT,
        });
      }).toThrow("Start pipe not found: 999 (asset does not exist)");
    });

    it("throws error for invalid endPipeId", () => {
      const IDS = { NONEXISTENT: 999 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 5],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [5, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
      });

      expect(() => {
        addLink(hydraulicModel, {
          startNode,
          endNode,
          link,
          endPipeId: IDS.NONEXISTENT,
        });
      }).toThrow("End pipe not found: 999 (asset does not exist)");
    });
  });

  describe("with overlapping pipe section", () => {
    it("replaces middle pipe section when drawing overlapping pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [30, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [30, 0],
          ],
          diameter: 100,
          roughness: 0.5,
        })
        .build();

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [20, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPipe({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(deleteAssets).toEqual([IDS.P1]);

      const pipes = putAssets!.filter((a) => a.type === "pipe") as Pipe[];
      expect(pipes).toHaveLength(3);

      const newPipe = pipes.find((p) => p.id === link.id);
      expect(newPipe).toBeDefined();
      const remainingPipes = pipes.filter((p) => p.id !== link.id);
      expect(remainingPipes).toHaveLength(2);

      const pipe1 = remainingPipes.find((p) => p.connections[0] === IDS.J1);
      const pipe2 = remainingPipes.find((p) => p.connections[1] === IDS.J2);

      expect(pipe1?.connections).toEqual([IDS.J1, startNode.id]);
      expect(pipe2?.connections).toEqual([endNode.id, IDS.J2]);
    });

    it("replaces section when drawing valve on same pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [30, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [30, 0],
          ],
          diameter: 150,
        })
        .build();

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [20, 0],
      });
      const link = hydraulicModel.assetBuilder.buildValve({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(deleteAssets).toEqual([IDS.P1]);

      const valve = putAssets!.find((a) => a.type === "valve") as Valve;
      expect(valve).toBeDefined();
      expect(valve.diameter).toBe(150);

      const pipes = putAssets!.filter((a) => a.type === "pipe") as Pipe[];
      expect(pipes).toHaveLength(2);
    });

    it("replaces section when drawing pump on same pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [30, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [30, 0],
          ],
          diameter: 200,
        })
        .build();

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [20, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(deleteAssets).toEqual([IDS.P1]);

      const pump = putAssets!.find((a) => a.type === "pump") as Pump;
      expect(pump).toBeDefined();
      expect(pump.isActive).toBe(true);

      const pipes = putAssets!.filter((a) => a.type === "pipe") as Pipe[];
      expect(pipes).toHaveLength(2);
    });

    it("falls back to standard split when new link has intermediate vertices", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [30, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [30, 0],
          ],
        })
        .build();

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [20, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPipe({
        coordinates: [
          [10, 0],
          [15, 5],
          [20, 0],
        ],
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      const pipes = putAssets!.filter((a) => a.type === "pipe") as Pipe[];
      expect(pipes).toHaveLength(4);
    });

    it("falls back when pipe has intermediate vertices not on new link path", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [30, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [15, 5],
            [30, 0],
          ],
        })
        .build();

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [0, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [30, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPipe({
        coordinates: [
          [0, 0],
          [30, 0],
        ],
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      const pipes = putAssets!.filter((a) => a.type === "pipe") as Pipe[];
      expect(pipes).toHaveLength(4);
    });

    it("reallocates or disconnects customer points to remaining pipes when drawing valve", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 3,
        CP1: 7,
        CP2: 8,
        CP3: 9,
      } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [30, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [30, 0],
          ],
        })
        .build();

      const cp1 = buildCustomerPoint(IDS.CP1, {
        coordinates: [5, 1],
        demand: 50,
      });
      cp1.connect({ pipeId: IDS.P1, snapPoint: [5, 0], junctionId: IDS.J1 });

      const cp2 = buildCustomerPoint(IDS.CP2, {
        coordinates: [25, 1],
        demand: 60,
      });
      cp2.connect({ pipeId: IDS.P1, snapPoint: [25, 0], junctionId: IDS.J2 });

      const cp3 = buildCustomerPoint(IDS.CP3, {
        coordinates: [15, 1],
        demand: 10,
      });
      cp3.connect({ pipeId: IDS.P1, snapPoint: [15, 0], junctionId: IDS.J2 });

      hydraulicModel.customerPoints.set(cp1.id, cp1);
      hydraulicModel.customerPoints.set(cp2.id, cp2);
      hydraulicModel.customerPoints.set(cp3.id, cp3);
      hydraulicModel.customerPointsLookup.addConnection(cp1);
      hydraulicModel.customerPointsLookup.addConnection(cp2);
      hydraulicModel.customerPointsLookup.addConnection(cp3);

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [20, 0],
      });
      const link = hydraulicModel.assetBuilder.buildValve({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const { putAssets, putCustomerPoints } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(putCustomerPoints).toHaveLength(3);
      const connectedCustomerPoints = putCustomerPoints?.filter(
        (cp) => !!cp.connection,
      );
      expect(connectedCustomerPoints).toHaveLength(2);
      const disconnectedCustommerPoint = putCustomerPoints?.find(
        (cp) => !cp.connection,
      );
      expect(disconnectedCustommerPoint!.id).toBe(cp3.id);

      const pipes = putAssets!.filter((a) => a.type === "pipe") as Pipe[];
      const pipeIds = pipes.map((p) => p.id);
      for (const cp of connectedCustomerPoints!) {
        expect(pipeIds).toContain(cp.connection?.pipeId);
      }
    });

    it("reallocates customer points to all pipes including new pipe when drawing pipe", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 3,
        CP1: 1,
      } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [30, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [30, 0],
          ],
        })
        .build();

      const cp1 = buildCustomerPoint(IDS.CP1, {
        coordinates: [15, 1],
        demand: 50,
      });
      cp1.connect({ pipeId: IDS.P1, snapPoint: [15, 0], junctionId: IDS.J1 });

      hydraulicModel.customerPoints.set(cp1.id, cp1);
      hydraulicModel.customerPointsLookup.addConnection(cp1);

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [20, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPipe({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const { putCustomerPoints } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(putCustomerPoints).toHaveLength(1);
      expect(putCustomerPoints![0].connection?.pipeId).toBe(link.id);
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

    const startNode = hydraulicModel.assetBuilder.buildJunction({
      coordinates: [10, 0],
    });
    const endNode = hydraulicModel.assetBuilder.buildJunction({
      coordinates: [10, 20],
    });
    const link = hydraulicModel.assetBuilder.buildPump({
      coordinates: [
        [10, 0],
        [10, 20],
      ],
    });

    const { putAssets, deleteAssets } = addLink(hydraulicModel, {
      startNode,
      endNode,
      link,
      startPipeId: IDS.P1,
      endPipeId: IDS.P2,
    });

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
      const IDS = { P1: 1, J1: 3, J2: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const startNode = hydraulicModel.assets.get(IDS.J1)!.copy() as Junction;
      const endNode = hydraulicModel.assets.get(IDS.J2)!.copy() as Junction;
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        isActive: true,
      });

      const { putAssets } = addLink(hydraulicModel, {
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

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 10],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [10, 0],
          [10, 10],
        ],
        isActive: true,
      });

      const { putAssets } = addLink(hydraulicModel, {
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
      const IDS = { P1: 1, J1: 2, J2: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [0, 10], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const startNode = hydraulicModel.assets.get(IDS.J1)!.copy() as Junction;
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        isActive: true,
      });

      const { putAssets } = addLink(hydraulicModel, {
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
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 } as const;
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
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [0, 15],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [0, 0],
          [0, 15],
        ],
        isActive: true,
      });

      const { putAssets } = addLink(hydraulicModel, {
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
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
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

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 10],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [10, 0],
          [10, 10],
        ],
        isActive: true,
      });

      const { putAssets } = addLink(hydraulicModel, {
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
      const hydraulicModel = HydraulicModelBuilder.with().build();

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [0, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        isActive: true,
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const [newPump, nodeA, nodeB] = putAssets || [];
      expect(newPump.isActive).toBe(true);
      expect(nodeA.isActive).toBe(true);
      expect(nodeB.isActive).toBe(true);
    });

    it("keeps isActive: true when one endpoint is active node with existing connections", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, pump: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: true })
        .aJunction(IDS.J3, { coordinates: [0, 10], isActive: true })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
        .build();

      const startNode = hydraulicModel.assets.get(IDS.J1)?.copy() as Junction;
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
        id: IDS.J1,
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLink(hydraulicModel, {
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

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [0, 0],
        id: IDS.J1,
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [0, 15],
        id: IDS.J4,
      });
      const link = hydraulicModel.assetBuilder.buildPump({
        coordinates: [
          [0, 0],
          [0, 15],
        ],
        id: IDS.pump,
        isActive: true,
      });

      const { putAssets } = addLink(hydraulicModel, {
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
