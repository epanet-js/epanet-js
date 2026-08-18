import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import type { Asset } from "src/hydraulic-model";
import {
  MapEditionsTracker,
  nullMapEditionsTracker,
} from "./map-editions-tracker";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
} as const;

describe("MapEditionsTracker", () => {
  it("starts with nothing edited", () => {
    const tracker = new MapEditionsTracker();

    expect(tracker.getSeq()).toEqual(0);
    expect(tracker.editedAssetIds()).toEqual(new Set());
    expect(tracker.editedCount()).toEqual(0);
  });

  it("has a null tracker that differs from a fresh one in id and seq", () => {
    const fresh = new MapEditionsTracker();

    expect(nullMapEditionsTracker.id).not.toEqual(fresh.id);
    expect(nullMapEditionsTracker.getSeq()).not.toEqual(fresh.getSeq());
  });

  it("stamps put assets", () => {
    const tracker = new MapEditionsTracker().record({
      note: "Add junction",
      putAssets: [anAsset(IDS.J1)],
    });

    expect(tracker.getSeq()).toEqual(1);
    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
  });

  it("stamps deleted and patched assets", () => {
    const tracker = new MapEditionsTracker()
      .record({ note: "Delete", deleteAssets: [IDS.J1] })
      .record({
        note: "Patch",
        patchAssetsAttributes: [
          { id: IDS.J2, type: "junction", properties: { elevation: 10 } },
        ],
      });

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1, IDS.J2]));
  });

  it("advances the seq for a moment that touches no asset", () => {
    const tracker = new MapEditionsTracker().record({ note: "Change demands" });

    expect(tracker.getSeq()).toEqual(1);
    expect(tracker.editedAssetIds()).toEqual(new Set());
  });

  it("only reports assets edited after the consolidation", () => {
    const consolidated = new MapEditionsTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });

    const tracker = consolidated
      .consolidate(consolidated.getSeq())
      .record({ note: "Add another", putAssets: [anAsset(IDS.J2)] });

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J2]));
    expect(tracker.editedCount()).toEqual(1);
  });

  it("re-stamps an asset edited again after the consolidation", () => {
    const consolidated = new MapEditionsTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });

    const tracker = consolidated
      .consolidate(consolidated.getSeq())
      .record({ note: "Move it", putAssets: [anAsset(IDS.J1)] });

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
  });

  it("counts each asset once no matter how often it changed", () => {
    const tracker = new MapEditionsTracker()
      .record({ note: "Add", putAssets: [anAsset(IDS.J1)] })
      .record({ note: "Move", putAssets: [anAsset(IDS.J1)] })
      .record({ note: "Move again", putAssets: [anAsset(IDS.J1)] });

    expect(tracker.editedCount()).toEqual(1);
  });

  it("advances the seq for a reverse moment, never backwards", () => {
    const tracker = new MapEditionsTracker()
      .record({ note: "Add", putAssets: [anAsset(IDS.J1)] })
      .record({ note: "Undo add", deleteAssets: [IDS.J1] });

    expect(tracker.getSeq()).toEqual(2);
    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
  });

  it("drops stamps up to the consolidated seq, keeping later ones", () => {
    const consolidated = new MapEditionsTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });

    const tracker = consolidated
      .record({ note: "Add another", putAssets: [anAsset(IDS.J2)] })
      .consolidate(consolidated.getSeq());

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J2]));
    expect(tracker.getSeq()).toEqual(2);
  });

  it("reports nothing edited when consolidated at the live seq", () => {
    const tracker = new MapEditionsTracker()
      .record({ note: "Add", putAssets: [anAsset(IDS.J1)] })
      .record({ note: "Add another", putAssets: [anAsset(IDS.J2)] });

    expect(tracker.consolidate(tracker.getSeq()).editedAssetIds()).toEqual(
      new Set(),
    );
  });

  it("carries the consolidation point across later records", () => {
    const consolidated = new MapEditionsTracker()
      .record({ note: "Add", putAssets: [anAsset(IDS.J1)] })
      .consolidate(1);

    const tracker = consolidated
      .record({ note: "Add another", putAssets: [anAsset(IDS.J2)] })
      .record({ note: "And another", putAssets: [anAsset(IDS.J3)] });

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J2, IDS.J3]));
  });

  it("keeps the id across records and consolidations", () => {
    const tracker = new MapEditionsTracker("tracker-1");

    expect(
      tracker.record({ note: "Add", putAssets: [anAsset(IDS.J1)] }).id,
    ).toEqual("tracker-1");
    expect(tracker.consolidate(0).id).toEqual("tracker-1");
  });

  it("leaves the receiver untouched when recording", () => {
    const tracker = new MapEditionsTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });

    tracker.record({ note: "Add another", putAssets: [anAsset(IDS.J2)] });

    expect(tracker.getSeq()).toEqual(1);
    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
  });

  it("leaves the receiver untouched when consolidating", () => {
    const tracker = new MapEditionsTracker().record({
      note: "Add",
      putAssets: [anAsset(IDS.J1)],
    });

    tracker.consolidate(1);

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
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
