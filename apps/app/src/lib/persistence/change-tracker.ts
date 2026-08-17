import { nanoid } from "nanoid";
import type { AssetId } from "src/hydraulic-model";
import type { Moment } from "./moment";

const INITIAL_SEQ = 0;

export class ChangeTracker {
  readonly id: string;
  private seq: number;
  private lastChangedAt: Map<AssetId, number>;

  constructor(id: string = nanoid()) {
    this.id = id;
    this.seq = INITIAL_SEQ;
    this.lastChangedAt = new Map();
  }

  record(moment: Moment): ChangeTracker {
    const next = this.clone();
    next.seq = this.seq + 1;

    for (const assetId of moment.deleteAssets || []) {
      next.lastChangedAt.set(assetId, next.seq);
    }
    for (const asset of moment.putAssets || []) {
      next.lastChangedAt.set(asset.id, next.seq);
    }
    for (const patch of moment.patchAssetsAttributes || []) {
      next.lastChangedAt.set(patch.id, next.seq);
    }

    return next;
  }

  trimUpTo(seq: number): ChangeTracker {
    const next = this.clone();
    for (const [assetId, changedAt] of next.lastChangedAt) {
      if (changedAt <= seq) next.lastChangedAt.delete(assetId);
    }
    return next;
  }

  getSeq(): Readonly<number> {
    return this.seq;
  }

  assetsChangedSince(seq: number): Set<AssetId> {
    const assetIds = new Set<AssetId>();
    for (const [assetId, changedAt] of this.lastChangedAt) {
      if (changedAt > seq) assetIds.add(assetId);
    }
    return assetIds;
  }

  countChangedSince(seq: number): number {
    let count = 0;
    for (const changedAt of this.lastChangedAt.values()) {
      if (changedAt > seq) count++;
    }
    return count;
  }

  private clone(): ChangeTracker {
    const next = new ChangeTracker(this.id);
    next.seq = this.seq;
    next.lastChangedAt = new Map(this.lastChangedAt);
    return next;
  }
}

export const nullChangeTracker = new ChangeTracker("null-change-tracker");
