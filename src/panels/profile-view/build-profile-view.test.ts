import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { createMockResultsReader } from "src/__helpers__/state";
import { buildProfileView } from "./build-profile-view";

describe("buildProfileView", () => {
  it("stores every path node as an anchor (densification)", () => {
    const IDS = { A: 1, B: 2, C: 3, P1: 4, P2: 5 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.A, endNodeId: IDS.B, length: 10 })
      .aPipe(IDS.P2, { startNodeId: IDS.B, endNodeId: IDS.C, length: 10 })
      .build();

    const result = buildProfileView({
      anchorIds: [IDS.A, IDS.C],
      hydraulicModel: model,
      isUnprojected: false,
    });

    expect("profileView" in result).toBe(true);
    if (!("profileView" in result)) return;

    expect(result.profileView.anchors).toEqual([IDS.A, IDS.B, IDS.C]);
    expect(result.profileView.anchors).toEqual(result.path.nodeIds);
  });

  it("uses flow weighting when results are provided", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      lowFlow1: 5,
      lowFlow2: 6,
      highFlow1: 7,
      highFlow2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.lowFlow1, {
        startNodeId: IDS.A,
        endNodeId: IDS.B,
        length: 10,
      })
      .aPipe(IDS.lowFlow2, {
        startNodeId: IDS.B,
        endNodeId: IDS.C,
        length: 10,
      })
      .aPipe(IDS.highFlow1, {
        startNodeId: IDS.A,
        endNodeId: IDS.D,
        length: 100,
      })
      .aPipe(IDS.highFlow2, {
        startNodeId: IDS.D,
        endNodeId: IDS.C,
        length: 100,
      })
      .build();

    const results = createMockResultsReader({
      pipes: {
        [IDS.lowFlow1]: { flow: 0.01 },
        [IDS.lowFlow2]: { flow: 0.01 },
        [IDS.highFlow1]: { flow: 100 },
        [IDS.highFlow2]: { flow: 100 },
      },
    });

    const result = buildProfileView({
      anchorIds: [IDS.A, IDS.C],
      hydraulicModel: model,
      isUnprojected: false,
      results,
    });

    if (!("profileView" in result)) {
      throw new Error("expected profileView, got error");
    }

    expect(result.profileView.anchors).toEqual([IDS.A, IDS.D, IDS.C]);
    expect(result.path.linkIds).toEqual([IDS.highFlow1, IDS.highFlow2]);
  });

  it("uses length-based shortest path when no results provided", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      short1: 5,
      short2: 6,
      long1: 7,
      long2: 8,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aJunction(IDS.D, { coordinates: [1, 1] })
      .aPipe(IDS.short1, { startNodeId: IDS.A, endNodeId: IDS.B, length: 10 })
      .aPipe(IDS.short2, { startNodeId: IDS.B, endNodeId: IDS.C, length: 10 })
      .aPipe(IDS.long1, { startNodeId: IDS.A, endNodeId: IDS.D, length: 100 })
      .aPipe(IDS.long2, { startNodeId: IDS.D, endNodeId: IDS.C, length: 100 })
      .build();

    const result = buildProfileView({
      anchorIds: [IDS.A, IDS.C],
      hydraulicModel: model,
      isUnprojected: false,
    });

    if (!("profileView" in result)) {
      throw new Error("expected profileView, got error");
    }

    expect(result.profileView.anchors).toEqual([IDS.A, IDS.B, IDS.C]);
    expect(result.path.linkIds).toEqual([IDS.short1, IDS.short2]);
  });

  it("preserves user-supplied intermediate anchors in the densified anchor list", () => {
    const IDS = {
      A: 1,
      B: 2,
      C: 3,
      D: 4,
      MID: 9,
      AB: 5,
      BC: 6,
      AC: 7,
      AMID: 8,
      MIDB: 10,
    } as const;

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.MID, { coordinates: [0.5, 0.5] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .aJunction(IDS.C, { coordinates: [2, 0] })
      .aPipe(IDS.AMID, { startNodeId: IDS.A, endNodeId: IDS.MID, length: 50 })
      .aPipe(IDS.MIDB, { startNodeId: IDS.MID, endNodeId: IDS.B, length: 50 })
      .aPipe(IDS.AB, { startNodeId: IDS.A, endNodeId: IDS.B, length: 1 })
      .aPipe(IDS.BC, { startNodeId: IDS.B, endNodeId: IDS.C, length: 10 })
      .build();

    const result = buildProfileView({
      anchorIds: [IDS.A, IDS.MID, IDS.C],
      hydraulicModel: model,
      isUnprojected: false,
    });

    if (!("profileView" in result)) {
      throw new Error("expected profileView, got error");
    }

    expect(result.profileView.anchors).toEqual([IDS.A, IDS.MID, IDS.B, IDS.C]);
  });

  it("returns noPath error when no route exists", () => {
    const IDS = { A: 1, B: 2 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.A, { coordinates: [0, 0] })
      .aJunction(IDS.B, { coordinates: [1, 0] })
      .build();

    const result = buildProfileView({
      anchorIds: [IDS.A, IDS.B],
      hydraulicModel: model,
      isUnprojected: false,
    });

    expect(result).toEqual({ error: "noPath" });
  });
});
