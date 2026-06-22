import { describe, it, expect } from "vitest";
import { LinkAsset } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  findOrphanLinkConnections,
  findStoreInconsistencies,
} from "./validate-moment-integrity";

const IDS = { J1: 1, J2: 2, P1: 3, MISSING: 999 } as const;

const buildModel = () =>
  HydraulicModelBuilder.with()
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

    const orphans = findOrphanLinkConnections(model, {
      note: "Delete junction only",
      deleteAssets: [IDS.J2],
    });

    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toMatchObject({
      linkId: IDS.P1,
      missingNodeIds: [IDS.J2],
      cause: "deleted-node",
    });
  });

  it("accepts deleting a node together with its connected pipe", () => {
    const model = buildModel();

    const orphans = findOrphanLinkConnections(model, {
      note: "Delete junction and pipe",
      deleteAssets: [IDS.J2, IDS.P1],
    });

    expect(orphans).toEqual([]);
  });

  it("flags putting a pipe that references a non-existent node", () => {
    const model = buildModel();
    const danglingPipe = (model.assets.get(IDS.P1) as LinkAsset).copy();
    danglingPipe.setConnections(IDS.J1, IDS.MISSING);

    const orphans = findOrphanLinkConnections(model, {
      note: "Reconnect pipe",
      putAssets: [danglingPipe],
    });

    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toMatchObject({
      linkId: IDS.P1,
      missingNodeIds: [IDS.MISSING],
      cause: "put-link",
    });
  });

  it("accepts a moment that creates a node and its pipe together", () => {
    const baseModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const fullModel = buildModel();
    const newNode = fullModel.assets.get(IDS.J2)!;
    const newPipe = fullModel.assets.get(IDS.P1)!;

    const orphans = findOrphanLinkConnections(baseModel, {
      note: "Add node and pipe",
      putAssets: [newNode, newPipe],
    });

    expect(orphans).toEqual([]);
  });
});

describe("findStoreInconsistencies", () => {
  it("accepts a consistent put (asset present in all its stores)", () => {
    const model = buildModel();

    const inconsistencies = findStoreInconsistencies(model, {
      note: "Touch pipe",
      putAssets: [model.assets.get(IDS.P1)!],
    });

    expect(inconsistencies).toEqual([]);
  });

  it("accepts a consistent delete (asset absent from all stores)", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const inconsistencies = findStoreInconsistencies(model, {
      note: "Delete missing pipe",
      deleteAssets: [IDS.P1],
    });

    expect(inconsistencies).toEqual([]);
  });

  it("flags a link present in assets/index but missing from topology", () => {
    const model = buildModel();
    // Manufacture the parallel-store desync the production bug produces: the
    // pipe stays in assets + assetIndex but its topology edge is gone.
    model.topology.removeLink(IDS.P1);

    const inconsistencies = findStoreInconsistencies(model, {
      note: "Buggy op",
      putAssets: [model.assets.get(IDS.P1)!],
    });

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
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    expect(model.topology.hasNode(IDS.J1)).toBe(false);

    const inconsistencies = findStoreInconsistencies(model, {
      note: "Add isolated junction",
      putAssets: [model.assets.get(IDS.J1)!],
    });

    expect(inconsistencies).toEqual([]);
  });
});
