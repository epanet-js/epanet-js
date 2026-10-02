import { describe, it, expect } from "vitest";
import { replaceLink } from "./replace-link";
import {
  HydraulicModelBuilder,
  buildPipe,
} from "src/__helpers__/hydraulic-model-builder";
import {
  AssetId,
  Pipe,
  Pump,
  LinkAsset,
  NodeAsset,
  Valve,
  CustomerPoint,
} from "@epanet-js/hydraulic-model";
import { Position } from "geojson";
import type { ChangeSet } from "@epanet-js/change-set";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";
import type { HydraulicModel } from "src/hydraulic-model";

const replace = (
  hydraulicModel: HydraulicModel,
  data: Parameters<typeof replaceLink>[1],
) => {
  const changeSet = replaceLink(hydraulicModel, data);
  applyOperation(hydraulicModel, changeSet, data.labelManager);
  return changeSet;
};

const changedEntities = (changeSet: ChangeSet) =>
  changeSet
    .summary()
    .map(({ entity, kind, count }) => `${entity}:${kind}:${count}`)
    .sort();

const assetOf = <T extends LinkAsset | NodeAsset>(
  model: HydraulicModel,
  id: AssetId,
) => model.assets.get(id) as T;

const customerPointOf = (model: HydraulicModel, id: number) =>
  model.customerPoints.get(id) as CustomerPoint;

const activeStates = (model: HydraulicModel, ids: AssetId[]) =>
  ids.map((id) => model.assets.get(id)!.isActive);

describe("replaceLink", () => {
  describe("basic functionality", () => {
    it("replaces existing pipe with new pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
          diameter: 200,
          isActive: true,
        })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 0],
        [5, 5],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const changeSet = replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(changeSet.name).toBe("replaceLink");
      expect(changedEntities(changeSet)).toEqual(["pipe:update:1"]);

      const replacedPipe = assetOf<Pipe>(hydraulicModel, IDS.P1);
      expect(replacedPipe.connections).toEqual([IDS.J1, IDS.J2]);
      expect(replacedPipe.coordinates).toEqual([
        [0, 0],
        [5, 5],
        [10, 0],
      ]);
      expect(replacedPipe.diameter).toBe(200);
      expect(replacedPipe.isActive).toBe(true);
    });

    it("moves the link onto new nodes and detaches it from the old ones", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 101, J4: 102 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 5],
        [10, 5],
      ]);
      const startNode = assetFactory.createJunction({
        id: IDS.J3,
        coordinates: [0, 5],
      });
      const endNode = assetFactory.createJunction({
        id: IDS.J4,
        coordinates: [10, 5],
      });

      replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(assetOf<Pipe>(hydraulicModel, IDS.P1).connections).toEqual([
        IDS.J3,
        IDS.J4,
      ]);
      expect(hydraulicModel.topology.getNodes(IDS.P1)).toEqual([
        IDS.J3,
        IDS.J4,
      ]);
      expect(hydraulicModel.topology.getLinks(IDS.J1)).toEqual([]);
      expect(hydraulicModel.topology.getLinks(IDS.J2)).toEqual([]);
    });

    it("throws error for mismatched link types", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
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

      const newPump = assetFactory.createPump({
        label: "PU1",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      expect(() =>
        replace(hydraulicModel, {
          assetFactory,
          labelManager,
          lengthUnit: "m",
          sourceLinkId: IDS.P1,
          newLink: newPump,
          startNode,
          endNode,
        }),
      ).toThrow("Link types must match");
    });

    it("throws when splitting the link being replaced", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
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

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 0],
        [10, 0],
      ]);

      const startNode = assetFactory.createJunction({
        coordinates: [2, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [8, 0],
      });

      expect(() =>
        replace(hydraulicModel, {
          assetFactory,
          labelManager,
          lengthUnit: "m",
          sourceLinkId: IDS.P1,
          newLink: newPipe,
          startNode,
          endNode,
          startPipeId: IDS.P1,
          endPipeId: IDS.P1,
        }),
      ).toThrow(`Cannot split link ${IDS.P1} while replacing it`);
    });
  });

  describe("auto-replace pipe section when redrawing", () => {
    it("replaces middle pipe section when redrawing pipe onto same pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, P2: 4, J3: 101, J4: 102 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
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
        .aPipe(IDS.P2, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [30, 0],
          ],
        })
        .build();

      const newPipe = buildPipe({
        id: IDS.P2,
        label: "P2",
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const startNode = assetFactory.createJunction({
        id: IDS.J3,
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        id: IDS.J4,
        coordinates: [20, 0],
      });

      const changeSet = replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P2,
        newLink: newPipe,
        startNode,
        endNode,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pipe:create:2",
        "pipe:delete:1",
        "pipe:update:1",
      ]);
      expect(hydraulicModel.assets.has(IDS.P1)).toBe(false);
      expect(assetOf<Pipe>(hydraulicModel, IDS.P2).connections).toEqual([
        IDS.J3,
        IDS.J4,
      ]);
    });

    it("replaces section when redrawing pipe as valve onto same pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, V1: 4, J3: 101, J4: 102 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
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
        .aValve(IDS.V1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [30, 0],
          ],
        })
        .build();

      const newValve = assetFactory.createValve({
        id: IDS.V1,
        label: "V1",
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const startNode = assetFactory.createJunction({
        id: IDS.J3,
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        id: IDS.J4,
        coordinates: [20, 0],
      });

      const changeSet = replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.V1,
        newLink: newValve,
        startNode,
        endNode,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pipe:create:2",
        "pipe:delete:1",
        "valve:update:1",
      ]);
      expect(hydraulicModel.assets.has(IDS.P1)).toBe(false);
      expect(assetOf<Valve>(hydraulicModel, IDS.V1).diameter).toBe(150);
    });
  });

  describe("active topology status inheritance", () => {
    it("inherits isActive from source link when replacing active link", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
          isActive: true,
        })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 0],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(activeStates(hydraulicModel, [IDS.P1, IDS.J1, IDS.J2])).toEqual([
        true,
        true,
        true,
      ]);
    });

    it("inherits isActive from source link when replacing inactive link", () => {
      const IDS = { J1: 1, J2: 2, P1: 4 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 0],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(activeStates(hydraulicModel, [IDS.P1, IDS.J1, IDS.J2])).toEqual([
        false,
        false,
        false,
      ]);
    });

    it("re-activates old nodes when removing only non-active link", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 101, J4: 102 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [2, 0],
        [8, 0],
      ]);
      const newStartNode = assetFactory.createJunction({
        id: IDS.J3,
        coordinates: [2, 0],
      });
      const newEndNode = assetFactory.createJunction({
        id: IDS.J4,
        coordinates: [8, 0],
      });

      const changeSet = replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode: newStartNode,
        endNode: newEndNode,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "junction:update:2",
        "pipe:update:1",
      ]);
      expect(
        activeStates(hydraulicModel, [IDS.J1, IDS.J2, IDS.J3, IDS.J4]),
      ).toEqual([true, true, false, false]);
    });

    it("deactivates previous nodes when removing only active link", () => {
      const IDS = { J1: 1, J2: 2, P0: 5, P1: 6, J3: 101, J4: 102 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: true })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: true })
        .aPipe(IDS.P0, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 0],
        [10, 0],
      ]);

      const newStartNode = assetFactory.createJunction({
        id: IDS.J3,
        coordinates: [2, 0],
      });

      const newEndNode = assetFactory.createJunction({
        id: IDS.J4,
        coordinates: [8, 0],
      });

      replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode: newStartNode,
        endNode: newEndNode,
      });

      expect(activeStates(hydraulicModel, [IDS.J1, IDS.J2])).toEqual([
        false,
        false,
      ]);
    });

    it("sets correct active state for nodes when redrawing inactive pipe splitting inactive and active pipes", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 5,
        P2: 6,
        P3: 7,
        N1: 8,
        N2: 9,
      } as const;

      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
          isActive: false,
        })
        .aJunction(IDS.J3, { coordinates: [0, 10], isActive: false })
        .aJunction(IDS.J4, { coordinates: [10, 10], isActive: false })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          coordinates: [
            [0, 10],
            [10, 10],
          ],
          isActive: false,
        })
        .aJunction(IDS.J3 + 10, { coordinates: [0, 20], isActive: true })
        .aJunction(IDS.J4 + 10, { coordinates: [10, 20], isActive: true })
        .aPipe(IDS.P3, {
          startNodeId: IDS.J3 + 10,
          endNodeId: IDS.J4 + 10,
          coordinates: [
            [0, 20],
            [10, 20],
          ],
          isActive: true,
        })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [5, 10], // Will split P2
        [5, 20], // Will split P3
      ]);

      const startNode = assetFactory.createJunction({
        id: IDS.N1,
        label: "N1",
        coordinates: [5, 10],
      });

      const endNode = assetFactory.createJunction({
        id: IDS.N2,
        label: "N2",
        coordinates: [5, 20],
      });

      replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
        startPipeId: IDS.P2,
        endPipeId: IDS.P3,
      });

      expect(activeStates(hydraulicModel, [IDS.P1, IDS.N1, IDS.N2])).toEqual([
        false,
        false,
        true,
      ]);
    });
  });

  describe("customer points reconnection", () => {
    it("reconnects customer points to closest junction", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
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
        .aCustomerPoint(IDS.CP1, {
          coordinates: [2, 1],
          connection: {
            pipeId: IDS.P1,
            snapPoint: [2, 0],
            junctionId: IDS.J1,
          },
        })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 0],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      const reconnectedCP = customerPointOf(hydraulicModel, IDS.CP1);
      expect(reconnectedCP.connection).not.toBeNull();
      expect(reconnectedCP.connection!.junctionId).toBe(IDS.J1);
      expect(reconnectedCP.connection!.pipeId).toBe(IDS.P1);
      expect(reconnectedCP.connection!.snapPoint).toEqual([2, 0]);
    });

    it("recalculates snap point when new pipe has different geometry", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
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
        .aCustomerPoint(IDS.CP1, {
          coordinates: [3, 2],
          connection: {
            pipeId: IDS.P1,
            snapPoint: [3, 0],
            junctionId: IDS.J1,
          },
        })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 0],
        [5, 5],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const changeSet = replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(changedEntities(changeSet)).toContain("customerPoint:update:1");

      const snapPoint = customerPointOf(hydraulicModel, IDS.CP1).connection!
        .snapPoint;
      expect(snapPoint).not.toEqual([3, 0]);
      expect(snapPoint[0]).toBeCloseTo(2.5, 1);
      expect(snapPoint[1]).toBeCloseTo(2.5, 1);
    });

    it("reconnects to farther junction when closer is not junction", () => {
      const IDS = { T1: 1, J2: 2, P1: 3, CP1: 4 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aTank(IDS.T1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.T1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [2, 1],
          connection: {
            pipeId: IDS.P1,
            snapPoint: [2, 0],
            junctionId: IDS.J2,
          },
        })
        .build();

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 0],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.T1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(
        customerPointOf(hydraulicModel, IDS.CP1).connection!.junctionId,
      ).toBe(IDS.J2);
    });

    it("disconnects customer points when no junctions available", () => {
      const IDS = { T1: 1, R1: 2, P1: 3, CP1: 4 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aTank(IDS.T1, { coordinates: [0, 0] })
        .aReservoir(IDS.R1, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.T1,
          endNodeId: IDS.R1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const customerPoint = new CustomerPoint(IDS.CP1, [5, 1], {
        label: "CP1",
      });
      customerPoint.connect({
        pipeId: IDS.P1,
        snapPoint: [5, 0],
        junctionId: IDS.T1,
      });
      hydraulicModel.customerPoints.set(IDS.CP1, customerPoint);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint);

      const newPipe = redrawn(hydraulicModel.assets.get(IDS.P1) as Pipe, [
        [0, 0],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.T1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.R1) as NodeAsset;

      const changeSet = replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(changedEntities(changeSet)).toContain("customerPoint:update:1");
      expect(customerPointOf(hydraulicModel, IDS.CP1).connection).toBeNull();
    });

    it("handles non-pipe links without customer point processing", () => {
      const IDS = { J1: 1, J2: 2, PU1: 3 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPump(IDS.PU1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const newPump = redrawn(hydraulicModel.assets.get(IDS.PU1) as Pump, [
        [0, 0],
        [5, 0],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const changeSet = replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.PU1,
        newLink: newPump,
        startNode,
        endNode,
      });

      expect(changedEntities(changeSet)).toEqual(["pump:update:1"]);
    });
  });

  describe("pump attribute preservation when redrawing", () => {
    it("preserves the pump curve and other attributes", () => {
      const IDS = { J1: 1, J2: 2, PU1: 3 } as const;
      const customCurve = [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 40 },
      ];
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPump(IDS.PU1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
          definitionType: "designPointCurve",
          curve: customCurve,
          speed: 2,
          initialStatus: "off",
        })
        .build();

      const sourcePump = hydraulicModel.assets.get(IDS.PU1) as Pump;

      // The redraw flow rebuilds the link from a copy of the source pump with
      // new geometry (see draw-link-handlers `startDrawing`).
      const redrawnPump = sourcePump.copy();
      redrawnPump.setCoordinates([
        [0, 0],
        [5, 5],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.PU1,
        newLink: redrawnPump,
        startNode,
        endNode,
      });

      const updatedPump = assetOf<Pump>(hydraulicModel, IDS.PU1);
      expect(updatedPump.curve).toEqual(customCurve);
      expect(updatedPump.definitionType).toEqual("designPointCurve");
      expect(updatedPump.speed).toEqual(2);
      expect(updatedPump.initialStatus).toEqual("off");
      expect(updatedPump.coordinates).toEqual([
        [0, 0],
        [5, 5],
        [10, 0],
      ]);
    });

    it("preserves valve attributes", () => {
      const IDS = { J1: 1, J2: 2, V1: 3 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aValve(IDS.V1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
          kind: "fcv",
          setting: 42,
          diameter: 250,
          minorLoss: 3,
          initialStatus: "closed",
        })
        .build();

      const sourceValve = hydraulicModel.assets.get(IDS.V1) as Valve;

      const redrawnValve = sourceValve.copy();
      redrawnValve.setCoordinates([
        [0, 0],
        [5, 5],
        [10, 0],
      ]);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      replace(hydraulicModel, {
        assetFactory,
        labelManager,
        lengthUnit: "m",
        sourceLinkId: IDS.V1,
        newLink: redrawnValve,
        startNode,
        endNode,
      });

      const updatedValve = assetOf<Valve>(hydraulicModel, IDS.V1);
      expect(updatedValve.kind).toEqual("fcv");
      expect(updatedValve.setting).toEqual(42);
      expect(updatedValve.diameter).toEqual(250);
      expect(updatedValve.minorLoss).toEqual(3);
      expect(updatedValve.initialStatus).toEqual("closed");
      expect(updatedValve.coordinates).toEqual([
        [0, 0],
        [5, 5],
        [10, 0],
      ]);
    });
  });

  describe("error cases", () => {
    it("throws error when source link not found", () => {
      const IDS = { NONEXISTENT: 999 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      }).build();

      const newPipe = assetFactory.createPipe({
        label: "P2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });

      const startNode = assetFactory.createJunction({
        coordinates: [0, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });

      expect(() =>
        replace(hydraulicModel, {
          assetFactory,
          labelManager,
          lengthUnit: "m",
          sourceLinkId: IDS.NONEXISTENT,
          newLink: newPipe,
          startNode,
          endNode,
        }),
      ).toThrow(`Source link with id ${IDS.NONEXISTENT} not found`);
    });

    it("throws when the new link does not keep the source id", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
      const { assetFactory, labelManager, idGenerator } = buildTestFactories();
      const hydraulicModel = HydraulicModelBuilder.with({
        assetFactory,
        labelManager,
        idGenerator,
      })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const newPipe = buildPipe({
        id: IDS.P2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });

      expect(() =>
        replace(hydraulicModel, {
          assetFactory,
          labelManager,
          lengthUnit: "m",
          sourceLinkId: IDS.P1,
          newLink: newPipe,
          startNode: hydraulicModel.assets.get(IDS.J1) as NodeAsset,
          endNode: hydraulicModel.assets.get(IDS.J2) as NodeAsset,
        }),
      ).toThrow("Replaced link must keep the source id");
    });
  });
});

const redrawn = <T extends LinkAsset>(link: T, coordinates: Position[]): T => {
  const copy = link.copy() as T;
  copy.setCoordinates(coordinates);
  return copy;
};
