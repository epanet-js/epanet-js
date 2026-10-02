import { describe, expect, it } from "vitest";
import { addLink } from "./add-link";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "../../__helpers__/hydraulic-model-builder";
import {
  Asset,
  AssetId,
  Pump,
  Pipe,
  Junction,
  Valve,
  AssetFactory,
  LabelManager,
  CustomerPoint,
} from "@epanet-js/hydraulic-model";
import { IdGenerator } from "@epanet-js/id-generator";
import type { ChangeSet } from "@epanet-js/change-set";
import { applyOperation } from "src/__helpers__/apply-operation";
import { HydraulicModel } from "../hydraulic-model";

class TestIdGenerator implements IdGenerator {
  private last: number;
  constructor(startAfter: number) {
    this.last = startAfter;
  }
  newId(): number {
    this.last = this.last + 1;
    return this.last;
  }
  get totalGenerated(): number {
    return this.last;
  }
  observe(id: number): void {
    if (id > this.last) this.last = id;
  }
  copy(): IdGenerator {
    return new TestIdGenerator(this.last);
  }
}

function createTestFactories(
  hydraulicModel: HydraulicModel,
  labelManager: LabelManager,
) {
  const maxId = Math.max(0, ...hydraulicModel.assets.keys());
  return {
    assetFactory: new AssetFactory(new TestIdGenerator(maxId), labelManager),
    labelManager,
  };
}

const add = (
  hydraulicModel: HydraulicModel,
  data: Parameters<typeof addLink>[1],
) => {
  const changeSet = addLink(hydraulicModel, data);
  applyOperation(hydraulicModel, changeSet, data.labelManager);
  return changeSet;
};

const changedEntities = (changeSet: ChangeSet) =>
  changeSet
    .summary()
    .map(({ entity, kind, count }) => `${entity}:${kind}:${count}`)
    .sort();

const assetOf = <T extends Asset>(model: HydraulicModel, id: AssetId) =>
  model.assets.get(id) as T;

const customerPointOf = (model: HydraulicModel, id: number) =>
  model.customerPoints.get(id) as CustomerPoint;

const changedPipes = (model: HydraulicModel, changeSet: ChangeSet) =>
  [...changeSet.entries()]
    .filter((entry) => entry.entity === "pipe" && entry.kind !== "delete")
    .map((entry) => assetOf<Pipe>(model, entry.id as AssetId));

const createdPipes = (model: HydraulicModel, changeSet: ChangeSet) =>
  [...changeSet.entries()]
    .filter((entry) => entry.entity === "pipe" && entry.kind === "create")
    .map((entry) => assetOf<Pipe>(model, entry.id as AssetId));

const pipeBetween = (
  model: HydraulicModel,
  changeSet: ChangeSet,
  startNodeId: AssetId,
  endNodeId: AssetId,
) => {
  const pipe = createdPipes(model, changeSet).find(
    (candidate) =>
      candidate.connections[0] === startNodeId &&
      candidate.connections[1] === endNodeId,
  );
  if (!pipe) throw new Error(`No pipe from ${startNodeId} to ${endNodeId}`);
  return pipe;
};

describe("addLink", () => {
  describe("basic functionality (no pipe splitting)", () => {
    it("updates connections", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction({
        coordinates: [10, 10],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [30, 30],
      });

      const link = assetFactory.createPump({
        coordinates: [
          [10, 10],
          [20, 20],
          [30, 30],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(changeSet.name).toBe("Add pump");
      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pump:create:1",
      ]);
      const pump = assetOf<Pump>(hydraulicModel, link.id);
      expect(pump.connections).toEqual([startNode.id, endNode.id]);
      expect(pump.coordinates).toEqual([
        [10, 10],
        [20, 20],
        [30, 30],
      ]);
      expect(hydraulicModel.topology.getNodes(link.id)).toEqual([
        startNode.id,
        endNode.id,
      ]);
    });

    it("removes redundant vertices", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction({
        coordinates: [10, 10],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [30, 30],
      });

      const link = assetFactory.createPump({
        coordinates: [
          [10, 10],
          [20, 20],
          [20, 20],
          [25, 25],
          [25, 25],
          [30, 30],
          [30, 30],
        ],
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(assetOf<Pump>(hydraulicModel, link.id).coordinates).toEqual([
        [10, 10],
        [20, 20],
        [25, 25],
        [30, 30],
      ]);
    });

    it("ensures at least it has two points", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction({
        coordinates: [0, 1],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [0, 2],
      });

      const link = assetFactory.createPump({
        coordinates: [
          [0, 1],
          [0, 1],
          [0, 1],
        ],
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(assetOf<Pump>(hydraulicModel, link.id).coordinates).toEqual([
        [0, 1],
        [0, 2],
      ]);
    });

    it("ensures connectivity with the link endpoints", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction({
        coordinates: [10, 10],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [20, 20],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [10, 11],
          [15, 15],
          [19 + 1e-10, 20],
          [19, 20],
        ],
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(assetOf<Pump>(hydraulicModel, link.id).coordinates).toEqual([
        [10, 10],
        [15, 15],
        [19 + 1e-10, 20],
        [20, 20],
      ]);
    });

    it("keeps pump length null (zero-length links)", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startCoordinates = [-4.3760931, 55.9150083];
      const endCoordiantes = [-4.3771833, 55.9133641];
      const startNode = assetFactory.createJunction({
        coordinates: startCoordinates,
      });
      const endNode = assetFactory.createJunction({
        coordinates: endCoordiantes,
      });
      const link = assetFactory.createPump({
        coordinates: [startCoordinates, endCoordiantes],
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      // Pumps are zero-length links in EPANET: no geometric length is derived.
      expect(assetOf<Pump>(hydraulicModel, link.id).length).toBeNull();
    });

    it("adds a label to the pump", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction();
      const endNode = assetFactory.createJunction();
      const link = assetFactory.createPump({
        label: "",
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(assetOf<Pump>(hydraulicModel, link.id).label).toEqual("PU1");
    });

    it("keeps the pump curve null when adding a pump", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction({
        coordinates: [10, 10],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [30, 30],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [10, 10],
          [30, 30],
        ],
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(assetOf<Pump>(hydraulicModel, link.id).curve).toBeNull();
    });

    it("adds a label to the nodes when missing", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction({
        label: "",
      });
      const endNode = assetFactory.createJunction({
        label: "CUSTOM",
      });
      const link = assetFactory.createPump({
        label: "",
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(assetOf<Junction>(hydraulicModel, startNode.id).label).toEqual(
        "J1",
      );
      expect(assetOf<Junction>(hydraulicModel, endNode.id).label).toEqual(
        "CUSTOM",
      );
    });
  });

  describe("pipe splitting functionality", () => {
    it("splits start pipe when startPipeId provided", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [5, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [5, 5],
      });
      const pump = assetFactory.createPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link: pump,
        startPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pipe:create:2",
        "pipe:delete:1",
        "pump:create:1",
      ]);
      expect(hydraulicModel.assets.has(IDS.P1)).toBe(false);

      expect(assetOf<Pump>(hydraulicModel, pump.id).connections).toEqual([
        startNode.id,
        endNode.id,
      ]);
      pipeBetween(hydraulicModel, changeSet, IDS.J1, startNode.id);
      pipeBetween(hydraulicModel, changeSet, startNode.id, IDS.J2);
    });

    it("splits end pipe when endPipeId provided", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [5, 5],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [5, 0],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        endPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pipe:create:2",
        "pipe:delete:1",
        "pump:create:1",
      ]);
      expect(assetOf<Pump>(hydraulicModel, link.id).connections).toEqual([
        startNode.id,
        endNode.id,
      ]);
      pipeBetween(hydraulicModel, changeSet, IDS.J1, endNode.id);
      pipeBetween(hydraulicModel, changeSet, endNode.id, IDS.J2);
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
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [5, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [5, 10],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [5, 0],
          [5, 10],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P2,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pipe:create:4",
        "pipe:delete:2",
        "pump:create:1",
      ]);
      expect(hydraulicModel.assets.has(IDS.P1)).toBe(false);
      expect(hydraulicModel.assets.has(IDS.P2)).toBe(false);
      expect(assetOf<Pump>(hydraulicModel, link.id).connections).toEqual([
        startNode.id,
        endNode.id,
      ]);
    });

    it("handles no pipe splitting (backward compatibility)", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction({
        coordinates: [10, 10],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [30, 30],
      });

      const link = assetFactory.createPump({
        coordinates: [
          [10, 10],
          [30, 30],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pump:create:1",
      ]);
      expect(assetOf<Pump>(hydraulicModel, link.id).connections).toEqual([
        startNode.id,
        endNode.id,
      ]);
    });

    it("reconnects customer points when splitting start pipe", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 3,
        CP1: 4,
      } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const customerPoint = buildCustomerPoint(IDS.CP1, {
        coordinates: [3, 1],
      });

      customerPoint.connect({
        pipeId: IDS.P1,
        snapPoint: [3, 0],
        junctionId: IDS.J1,
      });

      hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint);

      const startNode = assetFactory.createJunction({
        coordinates: [5, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [5, 5],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toContain("customerPoint:update:1");

      const reconnectedCP = customerPointOf(hydraulicModel, IDS.CP1);
      const firstSegment = pipeBetween(
        hydraulicModel,
        changeSet,
        IDS.J1,
        startNode.id,
      );
      expect(reconnectedCP.connection?.pipeId).toBe(firstSegment.id);
      expect(reconnectedCP.coordinates).toEqual([3, 1]);
    });

    it("reconnects customer points when splitting end pipe", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 3,
        CP1: 4,
      } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const customerPoint = buildCustomerPoint(IDS.CP1, {
        coordinates: [7, 1],
      });

      customerPoint.connect({
        pipeId: IDS.P1,
        snapPoint: [7, 0],
        junctionId: IDS.J2,
      });

      hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint);

      const startNode = assetFactory.createJunction({
        coordinates: [5, 5],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [5, 0],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        endPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toContain("customerPoint:update:1");

      const reconnectedCP = customerPointOf(hydraulicModel, IDS.CP1);
      const secondSegment = pipeBetween(
        hydraulicModel,
        changeSet,
        endNode.id,
        IDS.J2,
      );
      expect(reconnectedCP.coordinates).toEqual([7, 1]);
      expect(reconnectedCP.connection?.snapPoint).toEqual([7, 0]);
      expect(reconnectedCP.connection?.pipeId).toBe(secondSegment.id);
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
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const customerPoint1 = buildCustomerPoint(IDS.CP1, {
        coordinates: [3, 1],
      });
      const customerPoint2 = buildCustomerPoint(IDS.CP2, {
        coordinates: [7, 11],
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

      const startNode = assetFactory.createJunction({
        coordinates: [5, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [5, 10],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [5, 0],
          [5, 10],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P2,
      });

      expect(changedEntities(changeSet)).toContain("customerPoint:update:2");

      const cp1Reconnected = customerPointOf(hydraulicModel, IDS.CP1);
      const cp2Reconnected = customerPointOf(hydraulicModel, IDS.CP2);
      expect(cp1Reconnected.coordinates).toEqual([3, 1]);
      expect(cp2Reconnected.coordinates).toEqual([7, 11]);
      expect(cp1Reconnected.connection?.pipeId).toBe(
        pipeBetween(hydraulicModel, changeSet, IDS.J1, startNode.id).id,
      );
      expect(cp2Reconnected.connection?.pipeId).toBe(
        pipeBetween(hydraulicModel, changeSet, endNode.id, IDS.J4).id,
      );
    });

    it("throws error for invalid startPipeId", () => {
      const IDS = { NONEXISTENT: 999 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction({
        coordinates: [5, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [5, 5],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [5, 0],
          [5, 5],
        ],
      });

      expect(() => {
        add(hydraulicModel, {
          lengthUnit: "m",
          assetFactory,
          labelManager,
          startNode,
          endNode,
          link,
          startPipeId: IDS.NONEXISTENT,
        });
      }).toThrow("Start pipe not found: 999 (asset does not exist)");
    });

    it("throws error for invalid endPipeId", () => {
      const IDS = { NONEXISTENT: 999 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );
      const startNode = assetFactory.createJunction({
        coordinates: [5, 5],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [5, 0],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [5, 5],
          [5, 0],
        ],
      });

      expect(() => {
        add(hydraulicModel, {
          lengthUnit: "m",
          assetFactory,
          labelManager,
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
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [20, 0],
      });
      const link = assetFactory.createPipe({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pipe:create:3",
        "pipe:delete:1",
      ]);
      expect(hydraulicModel.assets.has(IDS.P1)).toBe(false);

      const pipes = changedPipes(hydraulicModel, changeSet);
      expect(pipes.map((pipe) => pipe.id)).toContain(link.id);
      expect(assetOf<Pipe>(hydraulicModel, link.id).connections).toEqual([
        startNode.id,
        endNode.id,
      ]);

      pipeBetween(hydraulicModel, changeSet, IDS.J1, startNode.id);
      pipeBetween(hydraulicModel, changeSet, endNode.id, IDS.J2);
    });

    it("replaces section when drawing valve on same pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [20, 0],
      });
      const link = assetFactory.createValve({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pipe:create:2",
        "pipe:delete:1",
        "valve:create:1",
      ]);
      expect(assetOf<Valve>(hydraulicModel, link.id).diameter).toBe(150);
    });

    it("replaces section when drawing pump on same pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [20, 0],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:2",
        "pipe:create:2",
        "pipe:delete:1",
        "pump:create:1",
      ]);
      expect(assetOf<Pump>(hydraulicModel, link.id).isActive).toBe(true);
    });

    it("falls back to standard split when new link has intermediate vertices", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [20, 0],
      });
      const link = assetFactory.createPipe({
        coordinates: [
          [10, 0],
          [15, 5],
          [20, 0],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(changedPipes(hydraulicModel, changeSet)).toHaveLength(4);
    });

    it("falls back when pipe has intermediate vertices not on new link path", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [0, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [30, 0],
      });
      const link = assetFactory.createPipe({
        coordinates: [
          [0, 0],
          [30, 0],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(changedPipes(hydraulicModel, changeSet)).toHaveLength(4);
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
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const cp1 = buildCustomerPoint(IDS.CP1, {
        coordinates: [5, 1],
      });
      cp1.connect({ pipeId: IDS.P1, snapPoint: [5, 0], junctionId: IDS.J1 });

      const cp2 = buildCustomerPoint(IDS.CP2, {
        coordinates: [25, 1],
      });
      cp2.connect({ pipeId: IDS.P1, snapPoint: [25, 0], junctionId: IDS.J2 });

      const cp3 = buildCustomerPoint(IDS.CP3, {
        coordinates: [15, 1],
      });
      cp3.connect({ pipeId: IDS.P1, snapPoint: [15, 0], junctionId: IDS.J2 });

      hydraulicModel.customerPoints.set(cp1.id, cp1);
      hydraulicModel.customerPoints.set(cp2.id, cp2);
      hydraulicModel.customerPoints.set(cp3.id, cp3);
      hydraulicModel.customerPointsLookup.addConnection(cp1);
      hydraulicModel.customerPointsLookup.addConnection(cp2);
      hydraulicModel.customerPointsLookup.addConnection(cp3);

      const startNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [20, 0],
      });
      const link = assetFactory.createValve({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toContain("customerPoint:update:3");
      expect(customerPointOf(hydraulicModel, IDS.CP3).connection).toBeNull();

      const pipeIds = changedPipes(hydraulicModel, changeSet).map(
        (pipe) => pipe.id,
      );
      for (const id of [IDS.CP1, IDS.CP2]) {
        const connection = customerPointOf(hydraulicModel, id).connection;
        expect(pipeIds).toContain(connection?.pipeId);
      }
    });

    it("reallocates customer points to all pipes including new pipe when drawing pipe", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        P1: 3,
        CP1: 1,
      } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const cp1 = buildCustomerPoint(IDS.CP1, {
        coordinates: [15, 1],
      });
      cp1.connect({ pipeId: IDS.P1, snapPoint: [15, 0], junctionId: IDS.J1 });

      hydraulicModel.customerPoints.set(cp1.id, cp1);
      hydraulicModel.customerPointsLookup.addConnection(cp1);

      const startNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [20, 0],
      });
      const link = assetFactory.createPipe({
        coordinates: [
          [10, 0],
          [20, 0],
        ],
      });

      const changeSet = add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(changedEntities(changeSet)).toContain("customerPoint:update:1");
      expect(customerPointOf(hydraulicModel, IDS.CP1).connection?.pipeId).toBe(
        link.id,
      );
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
    const labelManager = new LabelManager();
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
    const { assetFactory } = createTestFactories(hydraulicModel, labelManager);

    const startNode = assetFactory.createJunction({
      coordinates: [10, 0],
    });
    const endNode = assetFactory.createJunction({
      coordinates: [10, 20],
    });
    const link = assetFactory.createPump({
      coordinates: [
        [10, 0],
        [10, 20],
      ],
    });

    const changeSet = add(hydraulicModel, {
      lengthUnit: "m",
      assetFactory,
      labelManager,
      startNode,
      endNode,
      link,
      startPipeId: IDS.P1,
      endPipeId: IDS.P2,
    });

    expect(changedEntities(changeSet)).toEqual([
      "junction:create:2",
      "pipe:create:4",
      "pipe:delete:2",
      "pump:create:1",
    ]);

    const pipes = createdPipes(hydraulicModel, changeSet);
    expect(pipes.filter((p) => p.label.startsWith("P1"))).toHaveLength(2);
    expect(pipes.filter((p) => p.label.startsWith("P2"))).toHaveLength(2);

    expect(
      pipeBetween(hydraulicModel, changeSet, IDS.J1, startNode.id).coordinates,
    ).toEqual([
      [0, 0],
      [10, 0],
    ]);
    expect(
      pipeBetween(hydraulicModel, changeSet, startNode.id, IDS.J2).coordinates,
    ).toEqual([
      [10, 0],
      [20, 0],
    ]);
    expect(
      pipeBetween(hydraulicModel, changeSet, IDS.J3, endNode.id).coordinates,
    ).toEqual([
      [10, 10],
      [10, 20],
    ]);
    expect(
      pipeBetween(hydraulicModel, changeSet, endNode.id, IDS.J4).coordinates,
    ).toEqual([
      [10, 20],
      [10, 30],
    ]);
  });

  describe("isActive inference logic", () => {
    const activeStates = (
      model: HydraulicModel,
      ids: { link: AssetId; start: AssetId; end: AssetId },
    ) => [
      assetOf(model, ids.link).isActive,
      assetOf(model, ids.start).isActive,
      assetOf(model, ids.end).isActive,
    ];

    it("infers isActive: false when both endpoints are existing inactive nodes", () => {
      const IDS = { P1: 1, J1: 3, J2: 4 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = hydraulicModel.assets.get(IDS.J1)!.copy() as Junction;
      const endNode = hydraulicModel.assets.get(IDS.J2)!.copy() as Junction;
      const link = assetFactory.createPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([false, false, false]);
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
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [10, 10],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [10, 0],
          [10, 10],
        ],
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P2,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([false, false, false]);
    });

    it("infers isActive: false when one endpoint is existing inactive and other is new isolated", () => {
      const IDS = { P1: 1, J1: 2, J2: 3 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [0, 10], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = hydraulicModel.assets.get(IDS.J1)!.copy() as Junction;
      const endNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([false, false, false]);
    });

    it("infers isActive: false when one endpoint is existing inactive and other splits inactive pipe", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = hydraulicModel.assets.get(IDS.J1)!.copy() as Junction;
      const endNode = assetFactory.createJunction({
        coordinates: [0, 15],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [0, 0],
          [0, 15],
        ],
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        endPipeId: IDS.P1,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([false, false, false]);
    });

    it("infers isActive: false when one endpoint splits inactive pipe and other is new isolated", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [10, 10],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [10, 0],
          [10, 10],
        ],
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([false, false, false]);
    });

    it("keeps isActive: true when both endpoints are new isolated nodes (starting new network)", () => {
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({
        labelManager,
      }).build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [0, 0],
      });
      const endNode = assetFactory.createJunction({
        coordinates: [10, 0],
      });
      const link = assetFactory.createPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([true, true, true]);
    });

    it("keeps isActive: true when one endpoint is active node with existing connections", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, pump: 5 } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: true })
        .aJunction(IDS.J3, { coordinates: [0, 10], isActive: true })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
        .build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = hydraulicModel.assets.get(IDS.J1)?.copy() as Junction;
      const endNode = assetFactory.createJunction({
        coordinates: [10, 0],
        id: IDS.J2,
      });
      const link = assetFactory.createPump({
        coordinates: [
          [0, 0],
          [10, 0],
        ],
        id: IDS.pump,
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([true, true, true]);
    });

    it("keeps isActive: true when splitting an active pipe", () => {
      const IDS = {
        J2: 2,
        J3: 3,
        P1: 4,
        J1: 101,
        J4: 102,
        pump: 103,
      } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [0, 0],
        id: IDS.J1,
      });
      const endNode = assetFactory.createJunction({
        coordinates: [0, 15],
        id: IDS.J4,
      });
      const link = assetFactory.createPump({
        coordinates: [
          [0, 0],
          [0, 15],
        ],
        id: IDS.pump,
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        endPipeId: IDS.P1,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([true, true, true]);
    });

    it("activates the node splitting an inactive pipe when the other endpoint splits an active pipe", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 5,
        P2: 6,
        start: 101,
        end: 102,
        pump: 103,
      } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
        .aJunction(IDS.J3, { coordinates: [0, 10] })
        .aJunction(IDS.J4, { coordinates: [10, 10] })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          coordinates: [
            [0, 10],
            [10, 10],
          ],
          isActive: true,
        })
        .build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [5, 0],
        id: IDS.start,
      });
      const endNode = assetFactory.createJunction({
        coordinates: [5, 10],
        id: IDS.end,
      });
      const link = assetFactory.createPump({
        coordinates: [
          [5, 0],
          [5, 10],
        ],
        id: IDS.pump,
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
        endPipeId: IDS.P2,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([true, true, true]);
    });

    it("activates the node splitting an inactive pipe when the other endpoint is an existing active node", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 5,
        P2: 6,
        start: 101,
        pump: 102,
      } as const;
      const labelManager = new LabelManager();
      const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
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
        .aJunction(IDS.J3, { coordinates: [5, 10], isActive: true })
        .aJunction(IDS.J4, { coordinates: [5, 20], isActive: true })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          isActive: true,
        })
        .build();
      const { assetFactory } = createTestFactories(
        hydraulicModel,
        labelManager,
      );

      const startNode = assetFactory.createJunction({
        coordinates: [5, 0],
        id: IDS.start,
      });
      const endNode = hydraulicModel.assets.get(IDS.J3)?.copy() as Junction;
      const link = assetFactory.createPump({
        coordinates: [
          [5, 0],
          [5, 10],
        ],
        id: IDS.pump,
        isActive: true,
      });

      add(hydraulicModel, {
        lengthUnit: "m",
        assetFactory,
        labelManager,
        startNode,
        endNode,
        link,
        startPipeId: IDS.P1,
      });

      expect(
        activeStates(hydraulicModel, {
          link: link.id,
          start: startNode.id,
          end: endNode.id,
        }),
      ).toEqual([true, true, true]);
    });
  });
});
