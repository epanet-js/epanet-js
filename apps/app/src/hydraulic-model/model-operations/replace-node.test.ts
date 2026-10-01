import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ChangeSet } from "@epanet-js/change-set";
import { replaceNode } from "./replace-node";
import {
  AssetId,
  NodeAsset,
  LinkAsset,
  getJunctionDemands,
} from "@epanet-js/hydraulic-model";

type NodeType = "junction" | "reservoir" | "tank";

const setUp = () => {
  const factories = buildTestFactories();
  const builder = HydraulicModelBuilder.with(factories);
  return { ...factories, builder };
};

const replace = (
  model: HydraulicModel,
  { assetFactory, labelManager }: ReturnType<typeof buildTestFactories>,
  oldNodeId: AssetId,
  newNodeType: NodeType,
  elevation?: number | null,
) => {
  const changeSet = replaceNode(model, {
    assetFactory,
    oldNodeId,
    newNodeType,
    elevation,
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

const changedEntities = (changeSet: ChangeSet) =>
  changeSet
    .summary()
    .map(({ entity, kind, count }) => `${entity}:${kind}:${count}`)
    .sort();

const linkOf = (model: HydraulicModel, linkId: AssetId) =>
  model.assets.get(linkId) as LinkAsset;

describe("replaceNode", () => {
  it("replaces junction with tank and preserves connections", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const changeSet = replace(model, factories, IDS.J1, "tank");

    expect(changeSet.name).toBe("Replace junction with tank");
    expect(changedEntities(changeSet)).toEqual([
      "junction:delete:1",
      "pipe:update:1",
      "tank:create:1",
    ]);
    expect(model.assets.has(IDS.J1)).toBe(false);

    const newNode = createdNode(model, changeSet);
    expect(newNode.type).toBe("tank");
    expect(newNode.coordinates).toEqual([10, 20]);
    expect(newNode.elevation).toBe(100);
    expect(newNode.label).not.toBe("");

    const updatedPipe = linkOf(model, IDS.P1);
    expect(updatedPipe.connections).toEqual([newNode.id, IDS.J2]);
    expect(model.topology.getNodes(IDS.P1)).toEqual([newNode.id, IDS.J2]);
  });

  it("uses the provided elevation when the replaced node has none", () => {
    const IDS = { J1: 1 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: null })
      .build();

    const changeSet = replace(model, factories, IDS.J1, "tank", 42);

    expect(createdNode(model, changeSet).elevation).toBe(42);
  });

  it("keeps the existing elevation and ignores the provided fallback", () => {
    const IDS = { J1: 1 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .build();

    const changeSet = replace(model, factories, IDS.J1, "tank", 42);

    expect(createdNode(model, changeSet).elevation).toBe(100);
  });

  it("replaces reservoir with junction and preserves connections", () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aReservoir(IDS.R1, { coordinates: [5, 5], elevation: 50 })
      .aJunction(IDS.J1, { coordinates: [15, 15] })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const changeSet = replace(model, factories, IDS.R1, "junction");

    expect(changeSet.name).toBe("Replace reservoir with junction");
    expect(model.assets.has(IDS.R1)).toBe(false);

    const newNode = createdNode(model, changeSet);
    expect(newNode.type).toBe("junction");
    expect(newNode.coordinates).toEqual([5, 5]);
    expect(newNode.elevation).toBe(50);

    expect(linkOf(model, IDS.P1).connections).toEqual([newNode.id, IDS.J1]);
  });

  it("replaces tank with reservoir and preserves multiple connections", () => {
    const IDS = { T1: 1, J1: 2, J2: 3, J3: 4, P1: 5, P2: 6, P3: 7 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aTank(IDS.T1, { coordinates: [0, 0], elevation: 25 })
      .aJunction(IDS.J1, { coordinates: [10, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 10] })
      .aJunction(IDS.J3, { coordinates: [-10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
      .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J2 })
      .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.T1 })
      .build();

    const changeSet = replace(model, factories, IDS.T1, "reservoir");

    expect(changeSet.name).toBe("Replace tank with reservoir");
    expect(changedEntities(changeSet)).toEqual([
      "pipe:update:3",
      "reservoir:create:1",
      "tank:delete:1",
    ]);

    const newNode = createdNode(model, changeSet);
    expect(newNode.type).toBe("reservoir");
    expect(newNode.coordinates).toEqual([0, 0]);

    expect(linkOf(model, IDS.P1).connections).toEqual([newNode.id, IDS.J1]);
    expect(linkOf(model, IDS.P2).connections).toEqual([newNode.id, IDS.J2]);
    expect(linkOf(model, IDS.P3).connections).toEqual([IDS.J3, newNode.id]);
  });

  it("generates new auto-label for replaced node", () => {
    const IDS = { J1: 1 } as const;
    const { builder, ...factories } = setUp();
    const model = builder.aJunction(IDS.J1, { coordinates: [5, 5] }).build();

    const changeSet = replace(model, factories, IDS.J1, "tank");

    const newNode = createdNode(model, changeSet);
    expect(newNode.label).toMatch(/^T\d+$/);
    expect(newNode.label).not.toBe("J1");
  });

  it("uses default properties for new node type", () => {
    const IDS = { J1: 1 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aJunction(IDS.J1, { coordinates: [1, 1], elevation: 10 })
      .aJunctionDemand(IDS.J1, [{ baseDemand: 50 }])
      .build();

    const changeSet = replace(model, factories, IDS.J1, "tank");

    const newTank = createdNode(model, changeSet);
    expect(newTank.type).toBe("tank");
    expect(newTank.hasProperty("baseDemand")).toBe(false);
    expect(newTank.hasProperty("diameter")).toBe(true);
  });

  it("handles node with no connections", () => {
    const IDS = { J1: 1 } as const;
    const { builder, ...factories } = setUp();
    const model = builder.aJunction(IDS.J1, { coordinates: [0, 0] }).build();

    const changeSet = replace(model, factories, IDS.J1, "reservoir");

    expect(changeSet.name).toBe("Replace junction with reservoir");
    expect(changedEntities(changeSet)).toEqual([
      "junction:delete:1",
      "reservoir:create:1",
    ]);
    expect(createdNode(model, changeSet).type).toBe("reservoir");
  });

  it("throws error for invalid node ID", () => {
    const { assetFactory } = buildTestFactories();
    const model = HydraulicModelBuilder.empty();
    const invalidNodeId = 1;

    expect(() =>
      replaceNode(model, {
        assetFactory,
        oldNodeId: invalidNodeId,
        newNodeType: "junction",
      }),
    ).toThrow("Invalid node ID: 1");
  });

  it("throws error when trying to replace a link", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const { builder, assetFactory } = setUp();
    const model = builder
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 10] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    expect(() =>
      replaceNode(model, {
        assetFactory,
        oldNodeId: IDS.P1,
        newNodeType: "junction",
      }),
    ).toThrow(`Invalid node ID: ${IDS.P1}`);
  });

  it("reconnects customer points to the new node", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 0],
        connection: {
          pipeId: IDS.P1,
          snapPoint: [2, 0],
          junctionId: IDS.J1,
        },
      })
      .build();

    const changeSet = replace(model, factories, IDS.J1, "tank");

    expect(changedEntities(changeSet)).toContain("customerPoint:update:1");

    const reconnected = model.customerPoints.get(IDS.CP1)!;
    expect(reconnected.connection?.pipeId).toBe(IDS.P1);
    expect(reconnected.connection?.junctionId).not.toBe(IDS.J1);
  });

  it("preserves isActive when replacing active node", () => {
    const IDS = { J1: 1 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aJunction(IDS.J1, { coordinates: [0, 0], isActive: true })
      .build();

    const changeSet = replace(model, factories, IDS.J1, "tank");

    expect(createdNode(model, changeSet).isActive).toBe(true);
  });

  it("preserves isActive when replacing inactive node", () => {
    const IDS = { J1: 1 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
      .build();

    const changeSet = replace(model, factories, IDS.J1, "reservoir");

    expect(createdNode(model, changeSet).isActive).toBe(false);
  });

  it("clears junction demands when replacing junction with tank", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
      .aJunctionDemand(IDS.J1, [{ baseDemand: 50 }, { baseDemand: 30 }])
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    replace(model, factories, IDS.J1, "tank");

    expect(getJunctionDemands(model.demands, IDS.J1)).toEqual([]);
  });

  it("does not touch demands when replacing junction with no demands", () => {
    const IDS = { J1: 1 } as const;
    const { builder, ...factories } = setUp();
    const model = builder.aJunction(IDS.J1, { coordinates: [0, 0] }).build();

    const changeSet = replace(model, factories, IDS.J1, "reservoir");

    expect(changedEntities(changeSet)).not.toContainEqual(
      expect.stringMatching(/^junctionDemand:/),
    );
  });

  it("does not touch demands when replacing non-junction types", () => {
    const IDS = { T1: 1, J1: 2, P1: 3 } as const;
    const { builder, ...factories } = setUp();
    const model = builder
      .aTank(IDS.T1, { coordinates: [0, 0], elevation: 25 })
      .aJunction(IDS.J1, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
      .build();

    const changeSet = replace(model, factories, IDS.T1, "reservoir");

    expect(changedEntities(changeSet)).not.toContainEqual(
      expect.stringMatching(/^junctionDemand:/),
    );
  });
});
