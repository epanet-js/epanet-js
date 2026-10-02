import { describe, it, expect } from "vitest";
import { LabelManager, LinkAsset } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { changeSet, dropAssets, putAssets } from "./change-sets";
import {
  findOrphanLinkConnections,
  findStoreInconsistencies,
  findTopologyConnectionMismatches,
} from "./validate-change-set-integrity";

const IDS = { J1: 1, J2: 2, P1: 3, MISSING: 999 } as const;

const labelManager = new LabelManager();

const buildModel = () =>
  HydraulicModelBuilder.with({ labelManager })
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

describe("findOrphanLinkConnections", () => {
  it("flags deleting a node while a pipe still references it", () => {
    const model = buildModel();

    const orphans = findOrphanLinkConnections(
      model,
      changeSet(model, "Delete junction only", [dropAssets(IDS.J2)]),
    );

    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toMatchObject({
      linkId: IDS.P1,
      linkType: "pipe",
      missingNodeIds: [IDS.J2],
      cause: "deleted-node",
    });
  });

  it("accepts deleting a node together with its connected pipe", () => {
    const model = buildModel();

    const orphans = findOrphanLinkConnections(
      model,
      changeSet(model, "Delete junction and pipe", [
        dropAssets([IDS.J2, IDS.P1]),
      ]),
    );

    expect(orphans).toEqual([]);
  });

  it("flags rewiring a pipe to a non-existent node", () => {
    const model = buildModel();
    const danglingPipe = (model.assets.get(IDS.P1) as LinkAsset).copy();
    danglingPipe.setConnections(IDS.J1, IDS.MISSING);

    const orphans = findOrphanLinkConnections(
      model,
      changeSet(model, "Reconnect pipe", [putAssets([danglingPipe])]),
    );

    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toMatchObject({
      linkId: IDS.P1,
      missingNodeIds: [IDS.MISSING],
      cause: "put-link",
    });
  });

  it("flags an updated pipe whose unchanged node is deleted", () => {
    const model = buildModel();
    const relabelledPipe = (model.assets.get(IDS.P1) as LinkAsset).copy();
    relabelledPipe.setProperty("label", "RENAMED");

    const orphans = findOrphanLinkConnections(
      model,
      changeSet(model, "Relabel pipe and delete node", [
        dropAssets(IDS.J2),
        putAssets([relabelledPipe]),
      ]),
    );

    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toMatchObject({
      linkId: IDS.P1,
      missingNodeIds: [IDS.J2],
      cause: "put-link",
    });
  });

  it("accepts a change set that creates a node and its pipe together", () => {
    const baseModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const fullModel = buildModel();
    const newNode = fullModel.assets.get(IDS.J2)!;
    const newPipe = fullModel.assets.get(IDS.P1)!;

    const orphans = findOrphanLinkConnections(
      baseModel,
      changeSet(baseModel, "Add node and pipe", [
        putAssets([newNode, newPipe]),
      ]),
    );

    expect(orphans).toEqual([]);
  });
});

describe("findStoreInconsistencies", () => {
  it("accepts a consistent update (asset present in all its stores)", () => {
    const model = buildModel();
    const relabelledPipe = (model.assets.get(IDS.P1) as LinkAsset).copy();
    relabelledPipe.setProperty("label", "RENAMED");
    const operation = changeSet(model, "Relabel pipe", [
      putAssets([relabelledPipe]),
    ]);

    applyOperation(model, operation, labelManager);

    expect(findStoreInconsistencies(model, operation)).toEqual([]);
  });

  it("accepts a consistent delete (asset absent from all stores)", () => {
    const model = buildModel();
    const operation = changeSet(model, "Delete pipe", [dropAssets(IDS.P1)]);

    applyOperation(model, operation, labelManager);

    expect(findStoreInconsistencies(model, operation)).toEqual([]);
  });

  it("flags a link present in assets/index but missing from topology", () => {
    const model = buildModel();
    const relabelledPipe = (model.assets.get(IDS.P1) as LinkAsset).copy();
    relabelledPipe.setProperty("label", "RENAMED");
    const operation = changeSet(model, "Buggy op", [
      putAssets([relabelledPipe]),
    ]);
    applyOperation(model, operation, labelManager);
    model.topology.removeLink(IDS.P1);

    const inconsistencies = findStoreInconsistencies(model, operation);

    expect(inconsistencies).toHaveLength(1);
    expect(inconsistencies[0]).toMatchObject({
      id: IDS.P1,
      kind: "link",
      inAssets: true,
      inAssetIndex: true,
      inTopology: false,
    });
  });

  it("does not flag an isolated node (present in assets + index, absent from topology)", () => {
    const model = HydraulicModelBuilder.with({ labelManager }).build();
    const isolated = buildModel().assets.get(IDS.J1)!;
    const operation = changeSet(model, "Add isolated junction", [
      putAssets([isolated]),
    ]);

    applyOperation(model, operation, labelManager);

    expect(model.topology.hasNode(IDS.J1)).toBe(false);
    expect(findStoreInconsistencies(model, operation)).toEqual([]);
  });
});

describe("findTopologyConnectionMismatches", () => {
  it("accepts a rewired link whose topology follows its connections", () => {
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aJunction(4, { coordinates: [20, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();
    const rewired = (model.assets.get(IDS.P1) as LinkAsset).copy();
    rewired.setConnections(IDS.J1, 4);
    const operation = changeSet(model, "Rewire pipe", [putAssets([rewired])]);

    applyOperation(model, operation, labelManager);

    expect(findTopologyConnectionMismatches(model, operation)).toEqual([]);
  });

  it("flags a link whose topology disagrees with its connections", () => {
    const model = buildModel();
    const relabelledPipe = (model.assets.get(IDS.P1) as LinkAsset).copy();
    relabelledPipe.setProperty("label", "RENAMED");
    const operation = changeSet(model, "Buggy op", [
      putAssets([relabelledPipe]),
    ]);
    applyOperation(model, operation, labelManager);
    model.topology.removeLink(IDS.P1);
    model.topology.addLink(IDS.P1, IDS.J2, IDS.J1);

    expect(findTopologyConnectionMismatches(model, operation)).toEqual([
      {
        linkId: IDS.P1,
        assetConnections: [IDS.J1, IDS.J2],
        topologyConnections: [IDS.J2, IDS.J1],
      },
    ]);
  });
});
