import { describe, expect, it } from "vitest";
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

  it("stamps the recorded assets", () => {
    const tracker = new MapEditionsTracker().recordAssetIds([IDS.J1]);

    expect(tracker.getSeq()).toEqual(1);
    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
  });

  it("advances the seq for an edit that touches no asset", () => {
    const tracker = new MapEditionsTracker().recordAssetIds([]);

    expect(tracker.getSeq()).toEqual(1);
    expect(tracker.editedAssetIds()).toEqual(new Set());
  });

  it("only reports assets edited after the consolidation", () => {
    const consolidated = new MapEditionsTracker().recordAssetIds([IDS.J1]);

    const tracker = consolidated
      .consolidate(consolidated.getSeq())
      .recordAssetIds([IDS.J2]);

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J2]));
    expect(tracker.editedCount()).toEqual(1);
  });

  it("re-stamps an asset edited again after the consolidation", () => {
    const consolidated = new MapEditionsTracker().recordAssetIds([IDS.J1]);

    const tracker = consolidated
      .consolidate(consolidated.getSeq())
      .recordAssetIds([IDS.J1]);

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
  });

  it("counts each asset once no matter how often it changed", () => {
    const tracker = new MapEditionsTracker()
      .recordAssetIds([IDS.J1])
      .recordAssetIds([IDS.J1])
      .recordAssetIds([IDS.J1]);

    expect(tracker.editedCount()).toEqual(1);
  });

  it("advances the seq for an undo, never backwards", () => {
    const tracker = new MapEditionsTracker()
      .recordAssetIds([IDS.J1])
      .recordAssetIds([IDS.J1]);

    expect(tracker.getSeq()).toEqual(2);
    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
  });

  it("drops stamps up to the consolidated seq, keeping later ones", () => {
    const consolidated = new MapEditionsTracker().recordAssetIds([IDS.J1]);

    const tracker = consolidated
      .recordAssetIds([IDS.J2])
      .consolidate(consolidated.getSeq());

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J2]));
    expect(tracker.getSeq()).toEqual(2);
  });

  it("reports nothing edited when consolidated at the live seq", () => {
    const tracker = new MapEditionsTracker()
      .recordAssetIds([IDS.J1])
      .recordAssetIds([IDS.J2]);

    expect(tracker.consolidate(tracker.getSeq()).editedAssetIds()).toEqual(
      new Set(),
    );
  });

  it("carries the consolidation point across later records", () => {
    const consolidated = new MapEditionsTracker()
      .recordAssetIds([IDS.J1])
      .consolidate(1);

    const tracker = consolidated
      .recordAssetIds([IDS.J2])
      .recordAssetIds([IDS.J3]);

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J2, IDS.J3]));
  });

  it("keeps the id across records and consolidations", () => {
    const tracker = new MapEditionsTracker("tracker-1");

    expect(tracker.recordAssetIds([IDS.J1]).id).toEqual("tracker-1");
    expect(tracker.consolidate(0).id).toEqual("tracker-1");
  });

  it("leaves the receiver untouched when recording", () => {
    const tracker = new MapEditionsTracker().recordAssetIds([IDS.J1]);

    tracker.recordAssetIds([IDS.J2]);

    expect(tracker.getSeq()).toEqual(1);
    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
  });

  it("leaves the receiver untouched when consolidating", () => {
    const tracker = new MapEditionsTracker().recordAssetIds([IDS.J1]);

    tracker.consolidate(1);

    expect(tracker.editedAssetIds()).toEqual(new Set([IDS.J1]));
  });
});
