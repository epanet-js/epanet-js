import { describe, expect, it } from "vitest";
import { addNode } from "./add-node";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ChangeSet } from "@epanet-js/change-set";
import type { AssetId, NodeAsset, Pipe } from "@epanet-js/hydraulic-model";

type NodeType = "junction" | "reservoir" | "tank";

const setUp = () => {
  const factories = buildTestFactories();
  const builder = HydraulicModelBuilder.with(factories);
  return { ...factories, builder };
};

const add = (
  model: HydraulicModel,
  { assetFactory, labelManager }: ReturnType<typeof buildTestFactories>,
  data: {
    nodeType: NodeType;
    coordinates: [number, number];
    elevation?: number | null;
    pipeIdsToSplit?: AssetId[];
  },
) => {
  const changeSet = addNode(model, {
    ...data,
    lengthUnit: "m",
    assetFactory,
    labelManager,
  });
  applyOperation(model, changeSet, labelManager);
  return changeSet;
};

const createdNode = (model: HydraulicModel, changeSet: ChangeSet) => {
  for (const entry of changeSet.entries()) {
    if (
      entry.kind === "create" &&
      ["junction", "reservoir", "tank"].includes(entry.entity)
    ) {
      return model.assets.get(entry.id as AssetId) as NodeAsset;
    }
  }
  throw new Error("No node created");
};

const createdPipes = (model: HydraulicModel, changeSet: ChangeSet) =>
  [...changeSet.entries()]
    .filter((entry) => entry.kind === "create" && entry.entity === "pipe")
    .map((entry) => model.assets.get(entry.id as AssetId) as Pipe);

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

const changedEntities = (changeSet: ChangeSet) =>
  changeSet
    .summary()
    .map(({ entity, kind, count }) => `${entity}:${kind}:${count}`)
    .sort();

describe("addNode", () => {
  describe("without pipe splitting (backward compatibility)", () => {
    it("adds a junction with generated label", () => {
      const { builder, ...factories } = setUp();
      const model = builder.build();

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [10, 10],
        elevation: 100,
      });

      expect(changeSet.name).toBe("addNode");
      expect(changedEntities(changeSet)).toEqual(["junction:create:1"]);

      const junction = createdNode(model, changeSet);
      expect(junction.type).toBe("junction");
      expect(junction.coordinates).toEqual([10, 10]);
      expect(junction.elevation).toBe(100);
      expect(junction.label).toBe("J1");
      expect(junction.isActive).toBe(true);
    });

    it("adds a reservoir with specified elevation", () => {
      const { builder, ...factories } = setUp();
      const model = builder.build();

      const changeSet = add(model, factories, {
        nodeType: "reservoir",
        coordinates: [20, 20],
        elevation: 150,
      });

      expect(changedEntities(changeSet)).toEqual(["reservoir:create:1"]);

      const reservoir = createdNode(model, changeSet);
      expect(reservoir.type).toBe("reservoir");
      expect(reservoir.coordinates).toEqual([20, 20]);
      expect(reservoir.elevation).toBe(150);
      expect(reservoir.label).toBe("R1");
    });

    it("adds a tank with default elevation", () => {
      const { builder, ...factories } = setUp();
      const model = builder.build();

      const changeSet = add(model, factories, {
        nodeType: "tank",
        coordinates: [30, 30],
      });

      expect(changedEntities(changeSet)).toEqual(["tank:create:1"]);

      const tank = createdNode(model, changeSet);
      expect(tank.type).toBe("tank");
      expect(tank.coordinates).toEqual([30, 30]);
      expect(tank.elevation).toBe(0);
      expect(tank.label).toBe("T1");
    });
  });

  describe("with pipe splitting", () => {
    it("splits a pipe and adds a junction", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [5, 0],
        elevation: 50,
        pipeIdsToSplit: [IDS.P1],
      });

      expect(changeSet.name).toBe("addNode");
      expect(changedEntities(changeSet)).toEqual([
        "junction:create:1",
        "pipe:create:2",
        "pipe:delete:1",
      ]);
      expect(model.assets.has(IDS.P1)).toBe(false);

      const junction = createdNode(model, changeSet);
      expect(junction.type).toBe("junction");
      expect(junction.coordinates).toEqual([5, 0]);
      expect(junction.elevation).toBe(50);

      const pipe1 = pipeBetween(model, changeSet, IDS.J1, junction.id);
      const pipe2 = pipeBetween(model, changeSet, junction.id, IDS.J2);
      expect(pipe1.coordinates).toEqual([
        [0, 0],
        [5, 0],
      ]);
      expect(pipe2.coordinates).toEqual([
        [5, 0],
        [10, 0],
      ]);
      expect(model.topology.getNodes(pipe1.id)).toEqual([IDS.J1, junction.id]);
      expect(model.topology.getNodes(pipe2.id)).toEqual([junction.id, IDS.J2]);
    });

    it("uses node coordinates exactly as split point", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const nodeCoordinates: [number, number] = [5.123, 0.456];

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: nodeCoordinates,
        elevation: 50,
        pipeIdsToSplit: [IDS.P1],
      });

      const junction = createdNode(model, changeSet);
      const pipe1 = pipeBetween(model, changeSet, IDS.J1, junction.id);
      const pipe2 = pipeBetween(model, changeSet, junction.id, IDS.J2);

      expect(junction.coordinates).toEqual(nodeCoordinates);
      expect(pipe1.coordinates[pipe1.coordinates.length - 1]).toEqual(
        nodeCoordinates,
      );
      expect(pipe2.coordinates[0]).toEqual(nodeCoordinates);
    });

    it("labels the split segments after the original pipe", () => {
      const IDS = { J1: 1, J2: 2, MainPipe: 3 } as const;
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aPipe(IDS.MainPipe, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          label: "MainPipe",
        })
        .build();

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdsToSplit: [IDS.MainPipe],
      });

      const junction = createdNode(model, changeSet);
      expect(pipeBetween(model, changeSet, IDS.J1, junction.id).label).toBe(
        "MainPipe",
      );
      expect(pipeBetween(model, changeSet, junction.id, IDS.J2).label).toBe(
        "MainPipe_1",
      );
    });

    it("throws error for invalid pipe ID", () => {
      const { builder, ...factories } = setUp();
      const model = builder.build();

      const NonExistentPipeId = 1;

      expect(() =>
        add(model, factories, {
          nodeType: "junction",
          coordinates: [5, 0],
          pipeIdsToSplit: [NonExistentPipeId],
        }),
      ).toThrow("Invalid pipe ID: 1");
    });

    it("throws error when trying to split non-pipe asset", () => {
      const IDS = { J1: 1 } as const;
      const { builder, ...factories } = setUp();
      const model = builder.aNode(IDS.J1, [0, 0]).build();

      expect(() =>
        add(model, factories, {
          nodeType: "junction",
          coordinates: [5, 0],
          pipeIdsToSplit: [IDS.J1],
        }),
      ).toThrow(`Invalid pipe ID: ${IDS.J1}`);
    });

    it("reconnects customer points when splitting pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();

      const customerPoint = buildCustomerPoint(IDS.CP1, {
        coordinates: [3, 1],
      });
      customerPoint.connect({
        pipeId: IDS.P1,
        snapPoint: [3, 0],
        junctionId: IDS.J1,
      });
      model.customerPoints.set(customerPoint.id, customerPoint);
      model.customerPointsLookup.addConnection(customerPoint);

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdsToSplit: [IDS.P1],
      });

      expect(changedEntities(changeSet)).toContain("customerPoint:update:1");

      const junction = createdNode(model, changeSet);
      const pipe1 = pipeBetween(model, changeSet, IDS.J1, junction.id);
      const reconnected = model.customerPoints.get(IDS.CP1)!;
      expect(reconnected.connection?.pipeId).toBe(pipe1.id);
      expect(reconnected.connection?.junctionId).toBe(junction.id);
    });

    it("inherits isActive from pipe being split when pipe is active", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .build();

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdsToSplit: [IDS.P1],
      });

      expect(createdNode(model, changeSet).isActive).toBe(true);
    });

    it("inherits isActive from pipe being split when pipe is inactive", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdsToSplit: [IDS.P1],
      });

      expect(createdNode(model, changeSet).isActive).toBe(false);
    });
  });

  describe("node type validation", () => {
    it("throws error for unsupported node type", () => {
      const { builder, ...factories } = setUp();
      const model = builder.build();

      expect(() =>
        add(model, factories, {
          nodeType: "unsupported" as NodeType,
          coordinates: [0, 0],
        }),
      ).toThrow("Unsupported node type: unsupported");
    });
  });

  it("removes matching vertex when adding node at vertex location", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
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

    const changeSet = add(model, factories, {
      nodeType: "junction",
      coordinates: [5, 0],
      pipeIdsToSplit: [IDS.P1],
    });

    const junction = createdNode(model, changeSet);
    expect(
      pipeBetween(model, changeSet, IDS.J1, junction.id).coordinates,
    ).toEqual([
      [0, 0],
      [5, 0],
    ]);
    expect(
      pipeBetween(model, changeSet, junction.id, IDS.J2).coordinates,
    ).toEqual([
      [5, 0],
      [10, 0],
    ]);
  });

  it("handles multiple vertices correctly when adding node", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [20, 0])
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

    const changeSet = add(model, factories, {
      nodeType: "reservoir",
      coordinates: [10, 0],
      pipeIdsToSplit: [IDS.P1],
    });

    const reservoir = createdNode(model, changeSet);
    expect(reservoir.type).toBe("reservoir");
    expect(
      pipeBetween(model, changeSet, IDS.J1, reservoir.id).coordinates,
    ).toEqual([
      [0, 0],
      [5, 0],
      [10, 0],
    ]);
    expect(
      pipeBetween(model, changeSet, reservoir.id, IDS.J2).coordinates,
    ).toEqual([
      [10, 0],
      [15, 0],
      [20, 0],
    ]);
  });

  it("works with tank node type at vertex location", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aNode(IDS.J1, [0, 0])
      .aNode(IDS.J2, [10, 0])
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

    const changeSet = add(model, factories, {
      nodeType: "tank",
      coordinates: [5, 0],
      elevation: 100,
      pipeIdsToSplit: [IDS.P1],
    });

    const tank = createdNode(model, changeSet);
    expect(tank.type).toBe("tank");
    expect(pipeBetween(model, changeSet, IDS.J1, tank.id).coordinates).toEqual([
      [0, 0],
      [5, 0],
    ]);
    expect(pipeBetween(model, changeSet, tank.id, IDS.J2).coordinates).toEqual([
      [5, 0],
      [10, 0],
    ]);
  });

  describe("with multiple pipes to split", () => {
    const IDS = { A1: 1, A2: 2, PA: 3, B1: 4, B2: 5, PB: 6 } as const;

    const buildCrossing = ({
      paActive = true,
      pbActive = true,
    }: { paActive?: boolean; pbActive?: boolean } = {}) => {
      const { builder, ...factories } = setUp();
      const model = builder
        .aNode(IDS.A1, [0, 0])
        .aNode(IDS.A2, [10, 0])
        .aPipe(IDS.PA, {
          startNodeId: IDS.A1,
          endNodeId: IDS.A2,
          isActive: paActive,
        })
        .aNode(IDS.B1, [5, -5])
        .aNode(IDS.B2, [5, 5])
        .aPipe(IDS.PB, {
          startNodeId: IDS.B1,
          endNodeId: IDS.B2,
          isActive: pbActive,
        })
        .build();
      return { model, factories };
    };

    it("splits every pipe at the shared junction", () => {
      const { model, factories } = buildCrossing();

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [5, 0],
        elevation: 50,
        pipeIdsToSplit: [IDS.PA, IDS.PB],
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:1",
        "pipe:create:4",
        "pipe:delete:2",
      ]);
      expect(model.assets.has(IDS.PA)).toBe(false);
      expect(model.assets.has(IDS.PB)).toBe(false);

      const junction = createdNode(model, changeSet);
      expect(junction.type).toBe("junction");
      for (const pipe of createdPipes(model, changeSet)) {
        expect(pipe.connections).toContain(junction.id);
      }
      expect(model.topology.getLinks(junction.id)).toHaveLength(4);
    });

    it("keeps the junction active when any one split pipe is active", () => {
      const { model, factories } = buildCrossing({ pbActive: false });

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdsToSplit: [IDS.PA, IDS.PB],
      });

      expect(createdNode(model, changeSet).isActive).toBe(true);
    });

    it("makes the junction inactive when every split pipe is inactive", () => {
      const { model, factories } = buildCrossing({
        paActive: false,
        pbActive: false,
      });

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdsToSplit: [IDS.PA, IDS.PB],
      });

      expect(createdNode(model, changeSet).isActive).toBe(false);
    });

    it("splits a pipe once when the same id is given twice", () => {
      const { model, factories } = buildCrossing();

      const changeSet = add(model, factories, {
        nodeType: "junction",
        coordinates: [5, 0],
        pipeIdsToSplit: [IDS.PA, IDS.PA],
      });

      expect(changedEntities(changeSet)).toEqual([
        "junction:create:1",
        "pipe:create:2",
        "pipe:delete:1",
      ]);
      expect(model.assets.has(IDS.PB)).toBe(true);
    });

    it("throws when any id is not a pipe", () => {
      const { model, factories } = buildCrossing();

      expect(() =>
        add(model, factories, {
          nodeType: "junction",
          coordinates: [5, 0],
          pipeIdsToSplit: [IDS.PA, IDS.A1],
        }),
      ).toThrow(/Invalid pipe ID/);
    });
  });
});
