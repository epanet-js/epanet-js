import { describe, expect, it } from "vitest";
import { addLink } from "./add-link";
import {
  HydraulicModelBuilder,
  buildJunction,
  buildPump,
} from "../../__helpers__/hydraulic-model-builder";
import { Pump, Pipe } from "../asset-types";

describe("addLink", () => {
  describe("basic functionality (no pipe splitting)", () => {
    it("updates connections", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [10, 10], id: "A" });
      const endNode = buildJunction({ coordinates: [30, 30], id: "B" });

      const link = buildPump({
        coordinates: [
          [10, 10],
          [20, 20],
          [30, 30],
        ],
        id: "pump",
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      expect(putAssets![0].id).toEqual("pump");
      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.connections).toEqual(["A", "B"]);
      expect(pumpToCreate.coordinates).toEqual([
        [10, 10],
        [20, 20],
        [30, 30],
      ]);
    });

    it("removes redundant vertices", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [10, 10], id: "A" });
      const endNode = buildJunction({ coordinates: [30, 30], id: "B" });

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
        id: "pump",
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual("pump");
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
      const startNode = buildJunction({ coordinates: [0, 1], id: "A" });
      const endNode = buildJunction({ coordinates: [0, 1 + epsilon], id: "B" });

      const link = buildPump({
        coordinates: [
          [0, 1],
          [0, 1 + 2 * epsilon],
          [0, 1 + 3 * epsilon],
        ],
        id: "pump",
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual("pump");
      expect(pumpToCreate.coordinates).toEqual([
        [0, 1],
        [0, 1 + epsilon],
      ]);
    });

    it("ensures connectivity with the link endpoints", () => {
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
        id: "pump",
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual("pump");
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
      const startNode = buildJunction({ coordinates: startCoordinates });
      const endNode = buildJunction({ coordinates: endCoordiantes });
      const link = buildPump({
        coordinates: [startCoordinates, endCoordiantes],
        id: "pump",
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual("pump");
      expect(pumpToCreate.length).toBeCloseTo(195.04);
    });

    it("adds a label to the pump", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction();
      const endNode = buildJunction();
      const link = buildPump({
        id: "pump",
        label: "",
      });

      const { putAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
      });

      const pumpToCreate = putAssets![0] as Pump;
      expect(pumpToCreate.id).toEqual("pump");
      expect(pumpToCreate.label).toEqual("PU1");
    });

    it("adds a label to the nodes when missing", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ label: "" });
      const endNode = buildJunction({ label: "CUSTOM" });
      const link = buildPump({
        id: "pump",
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
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const startNode = buildJunction({
        coordinates: [5, 0],
        id: "J3",
      });
      const endNode = buildJunction({
        coordinates: [5, 5],
        id: "J4",
      });
      const link = buildPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
        id: "pump1",
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: "P1",
      });

      expect(putAssets).toHaveLength(5);
      expect(deleteAssets).toEqual(["P1"]);

      const [newPump, , , splitPipe1, splitPipe2] = putAssets!;

      expect(newPump.type).toBe("pump");
      expect(newPump.id).toBe("pump1");
      expect((newPump as Pump).connections).toEqual(["J3", "J4"]);

      expect(splitPipe1.type).toBe("pipe");
      expect(splitPipe2.type).toBe("pipe");
      expect((splitPipe1 as Pipe).connections).toEqual(["J1", "J3"]);
      expect((splitPipe2 as Pipe).connections).toEqual(["J3", "J2"]);
    });

    it("splits end pipe when endPipeId provided", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const startNode = buildJunction({
        coordinates: [5, 5],
        id: "J3",
      });
      const endNode = buildJunction({
        coordinates: [5, 0],
        id: "J4",
      });
      const link = buildPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
        id: "pump1",
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        endPipeId: "P1",
      });

      expect(putAssets).toHaveLength(5);
      expect(deleteAssets).toEqual(["P1"]);

      const [newPump, , , splitPipe1, splitPipe2] = putAssets!;

      expect(newPump.type).toBe("pump");
      expect((newPump as Pump).connections).toEqual(["J3", "J4"]);

      expect((splitPipe1 as Pipe).connections).toEqual(["J1", "J4"]);
      expect((splitPipe2 as Pipe).connections).toEqual(["J4", "J2"]);
    });

    it("splits both start and end pipes", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aJunction("J3", { coordinates: [0, 10] })
        .aJunction("J4", { coordinates: [10, 10] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aPipe("P2", {
          startNodeId: "J3",
          endNodeId: "J4",
          coordinates: [
            [0, 10],
            [10, 10],
          ],
        })
        .build();

      const startNode = buildJunction({
        coordinates: [5, 0],
        id: "J5",
      });
      const endNode = buildJunction({
        coordinates: [5, 10],
        id: "J6",
      });
      const link = buildPump({
        coordinates: [
          [5, 0],
          [5, 10],
        ],
        id: "pump1",
      });

      const { putAssets, deleteAssets } = addLink(hydraulicModel, {
        startNode,
        endNode,
        link,
        startPipeId: "P1",
        endPipeId: "P2",
      });

      expect(putAssets).toHaveLength(7);
      expect(deleteAssets).toEqual(["P1", "P2"]);

      const [newPump, , , ...splitPipes] = putAssets!;

      expect(newPump.type).toBe("pump");
      expect((newPump as Pump).connections).toEqual(["J5", "J6"]);
      expect(splitPipes).toHaveLength(4);
      expect(splitPipes.every((pipe) => pipe.type === "pipe")).toBe(true);
    });

    it("handles no pipe splitting (backward compatibility)", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [10, 10], id: "A" });
      const endNode = buildJunction({ coordinates: [30, 30], id: "B" });

      const link = buildPump({
        coordinates: [
          [10, 10],
          [30, 30],
        ],
        id: "pump",
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
      expect((newPump as Pump).connections).toEqual(["A", "B"]);
    });

    it("throws error for invalid startPipeId", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [5, 0], id: "J3" });
      const endNode = buildJunction({ coordinates: [5, 5], id: "J4" });
      const link = buildPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
        id: "pump1",
      });

      expect(() => {
        addLink(hydraulicModel, {
          startNode,
          endNode,
          link,
          startPipeId: "NONEXISTENT",
        });
      }).toThrow("Invalid pipe ID: NONEXISTENT");
    });

    it("throws error for invalid endPipeId", () => {
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const startNode = buildJunction({ coordinates: [5, 5], id: "J3" });
      const endNode = buildJunction({ coordinates: [5, 0], id: "J4" });
      const link = buildPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
        id: "pump1",
      });

      expect(() => {
        addLink(hydraulicModel, {
          startNode,
          endNode,
          link,
          endPipeId: "NONEXISTENT",
        });
      }).toThrow("Invalid pipe ID: NONEXISTENT");
    });
  });
});
