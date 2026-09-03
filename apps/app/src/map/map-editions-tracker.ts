import { nanoid } from "nanoid";
import type { AssetId } from "src/hydraulic-model";
import type { Moment } from "src/lib/persistence/moment";

const INITIAL_SEQ = 0;
const INITIAL_SYNC_SEQ = -1;

// Distinct from any real tracker in both signals, so the first cycle reads as a new import
// with new editions rather than as "nothing changed".
const NULL_ID = "";
const NULL_SEQ = -1;

export class MapEditionsTracker {
  readonly id: string;
  private seq: number;
  private syncSeq: number;
  private lastChangedAt: Map<AssetId, number>;

  constructor(id: string = nanoid()) {
    this.id = id;
    this.seq = INITIAL_SEQ;
    this.syncSeq = INITIAL_SYNC_SEQ;
    this.lastChangedAt = new Map();
  }

  record(moment: Moment): MapEditionsTracker {
    return this.recordAssetIds([
      ...(moment.deleteAssets || []),
      ...(moment.putAssets || []).map((asset) => asset.id),
      ...(moment.patchAssetsAttributes || []).map((patch) => patch.id),
    ]);
  }

  recordAssetIds(assetIds: Iterable<AssetId>): MapEditionsTracker {
    const next = this.clone();
    next.seq = this.seq + 1;

    for (const assetId of assetIds) {
      next.lastChangedAt.set(assetId, next.seq);
    }

    return next;
  }

  // Takes the seq the snapshot was built from, never the live one: the build yields, so a
  // transaction landing mid-build has already advanced `seq` past what was rendered.
  consolidate(atSeq: number): MapEditionsTracker {
    const next = this.clone();
    next.syncSeq = atSeq;
    for (const [assetId, changedAt] of next.lastChangedAt) {
      if (changedAt <= atSeq) next.lastChangedAt.delete(assetId);
    }
    return next;
  }

  getSeq(): Readonly<number> {
    return this.seq;
  }

  editedAssetIds(): Set<AssetId> {
    const assetIds = new Set<AssetId>();
    for (const [assetId, changedAt] of this.lastChangedAt) {
      if (changedAt > this.syncSeq) assetIds.add(assetId);
    }
    return assetIds;
  }

  editedCount(): number {
    let count = 0;
    for (const changedAt of this.lastChangedAt.values()) {
      if (changedAt > this.syncSeq) count++;
    }
    return count;
  }

  static null(): MapEditionsTracker {
    const tracker = new MapEditionsTracker(NULL_ID);
    tracker.seq = NULL_SEQ;
    return tracker;
  }

  private clone(): MapEditionsTracker {
    const next = new MapEditionsTracker(this.id);
    next.seq = this.seq;
    next.syncSeq = this.syncSeq;
    next.lastChangedAt = new Map(this.lastChangedAt);
    return next;
  }
}

export const nullMapEditionsTracker = MapEditionsTracker.null();
