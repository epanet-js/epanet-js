import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import type { Asset } from "src/hydraulic-model";
import { ChangeTracker } from "./change-tracker";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
} as const;

describe("ChangeTracker", () => {
  it("starts with nothing changed", () => {
    const tracker = new ChangeTracker();

    expect(tracker.getSeq()).toEqual(0);
    expect(tracker.assetsChangedSince(0)).toEqual(new Set());
    expect(tracker.countChangedSince(0)).toEqual(0);
  });

  it("stamps put assets", () => {
    const tracker = new ChangeTracker().record({
      note: "Add junction",
      putAssets: [anAsset(IDS.J1)],
    });

    expect(tracker.getSeq()).toEqual(1);
    expect(tracker.assetsChangedSince(0)).toEqual(new Set([IDS.J1]));
  });

  it("stamps deleted and patched assets", () => {
    const tracker = new ChangeTracker()
      .record({ note: "Delete", deleteAssets: [IDS.J1] })
      .record({
        note: "Patch",
        patchAssetsAttributes: [
          { id: IDS.J2, type: "junction", properties: { elevation: 10 } },
        ],
      });

    expect(tracker.assetsChangedSince(0)).toEqual(new Set([IDS.J1, IDS.J2]));
  });

  it("advances the seq for a moment that touches no asset", () => {
    const tracker = new ChangeTracker().record({ note: "Change demands" });

    expect(tracker.getSeq()).toEqual(1);
    expect(tracker.assetsChangedSince(0)).toEqual(new Set());
  });

  it("only reports assets changed after the given seq", () => {
    const consolidated = new ChangeTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });
    const seqAtConsolidation = consolidated.getSeq();

    const tracker = consolidated.record({
      note: "Add another",
      putAssets: [anAsset(IDS.J2)],
    });

    expect(tracker.assetsChangedSince(seqAtConsolidation)).toEqual(
      new Set([IDS.J2]),
    );
    expect(tracker.countChangedSince(seqAtConsolidation)).toEqual(1);
  });

  it("re-stamps an asset changed again after the given seq", () => {
    const consolidated = new ChangeTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });
    const seqAtConsolidation = consolidated.getSeq();

    const tracker = consolidated.record({
      note: "Move it",
      putAssets: [anAsset(IDS.J1)],
    });

    expect(tracker.assetsChangedSince(seqAtConsolidation)).toEqual(
      new Set([IDS.J1]),
    );
  });

  it("counts each asset once no matter how often it changed", () => {
    const tracker = new ChangeTracker()
      .record({ note: "Add", putAssets: [anAsset(IDS.J1)] })
      .record({ note: "Move", putAssets: [anAsset(IDS.J1)] })
      .record({ note: "Move again", putAssets: [anAsset(IDS.J1)] });

    expect(tracker.countChangedSince(0)).toEqual(1);
  });

  it("advances the seq for a reverse moment, never backwards", () => {
    const tracker = new ChangeTracker()
      .record({ note: "Add", putAssets: [anAsset(IDS.J1)] })
      .record({ note: "Undo add", deleteAssets: [IDS.J1] });

    expect(tracker.getSeq()).toEqual(2);
    expect(tracker.assetsChangedSince(1)).toEqual(new Set([IDS.J1]));
  });

  it("drops stamps up to the given seq when trimmed", () => {
    const consolidated = new ChangeTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });
    const tracker = consolidated
      .record({ note: "Add another", putAssets: [anAsset(IDS.J2)] })
      .trimUpTo(consolidated.getSeq());

    expect(tracker.assetsChangedSince(0)).toEqual(new Set([IDS.J2]));
    expect(tracker.getSeq()).toEqual(2);
  });

  it("keeps the id across records and trims", () => {
    const tracker = new ChangeTracker("tracker-1");

    expect(
      tracker.record({ note: "Add", putAssets: [anAsset(IDS.J1)] }).id,
    ).toEqual("tracker-1");
    expect(tracker.trimUpTo(0).id).toEqual("tracker-1");
  });

  it("leaves the receiver untouched when recording", () => {
    const tracker = new ChangeTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });

    tracker.record({ note: "Add another", putAssets: [anAsset(IDS.J2)] });

    expect(tracker.getSeq()).toEqual(1);
    expect(tracker.assetsChangedSince(0)).toEqual(new Set([IDS.J1]));
  });

  it("leaves the receiver untouched when trimming", () => {
    const tracker = new ChangeTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });

    tracker.trimUpTo(1);

    expect(tracker.assetsChangedSince(0)).toEqual(new Set([IDS.J1]));
  });

  const assets = HydraulicModelBuilder.with()
    .aJunction(IDS.J1)
    .aJunction(IDS.J2)
    .aJunction(IDS.J3)
    .build().assets;

  const anAsset = (id: number): Asset => {
    const asset = assets.get(id);
    if (!asset) throw new Error(`No asset for ${id}`);
    return asset;
  };
});
