import type { Category, Sel } from "./types";
import type { IWrappedFeature } from "src/types";
import type { AssetsMap } from "src/hydraulic-model";
import { type CustomerPoints } from "@epanet-js/hydraulic-model";
import { EMPTY_ARRAY } from "src/lib/constants";

const EMPTY_NUMBER_ARRAY: readonly number[] = EMPTY_ARRAY;

export const SELECTION_NONE: Sel = {
  asset: EMPTY_NUMBER_ARRAY,
  customerPoint: EMPTY_NUMBER_ARRAY,
};

const make = (
  asset: readonly number[],
  customerPoint: readonly number[],
): Sel => {
  if (asset.length === 0 && customerPoint.length === 0) return SELECTION_NONE;
  return { asset, customerPoint };
};

const rebuild = (
  prev: Sel,
  asset: readonly number[],
  customerPoint: readonly number[],
): Sel => {
  if (asset === prev.asset && customerPoint === prev.customerPoint) {
    return prev;
  }
  return make(asset, customerPoint);
};

export const USelection = {
  /**
   * Return asset ids in the selection. The stored array reference is returned
   * as-is, so it is stable across updates that don't touch the asset set.
   */
  getAssetIds(selection: Sel): readonly IWrappedFeature["id"][] {
    return selection.asset;
  },
  /**
   * Return customer point ids in the selection. Stable reference, as above.
   */
  getCustomerPointIds(selection: Sel): readonly number[] {
    return selection.customerPoint;
  },
  countByKind(selection: Sel): { assets: number; customerPoints: number } {
    return {
      assets: selection.asset.length,
      customerPoints: selection.customerPoint.length,
    };
  },
  isEmpty(selection: Sel): boolean {
    return selection.asset.length === 0 && selection.customerPoint.length === 0;
  },
  isNone(selection: Sel): boolean {
    return this.isEmpty(selection);
  },
  /**
   * Short human-readable label for logging/telemetry, e.g.
   * "none" | "single/asset" | "single/customerPoint" |
   * "multi/asset" | "multi/customerPoint" | "multi/mixed".
   */
  describe(selection: Sel): string {
    const { assets: assetCount, customerPoints: cpCount } =
      USelection.countByKind(selection);
    if (assetCount === 0 && cpCount === 0) return "none";
    if (assetCount > 0 && cpCount > 0) return "multi/mixed";
    const kind = assetCount > 0 ? "asset" : "customerPoint";
    const total = assetCount + cpCount;
    return `${total === 1 ? "single" : "multi"}/${kind}`;
  },
  fromAssetIds(ids: readonly IWrappedFeature["id"][]): Sel {
    return make(dedupIds(ids), EMPTY_NUMBER_ARRAY);
  },
  isAssetSelected(selection: Sel, id: IWrappedFeature["id"]): boolean {
    return selection.asset.includes(id);
  },
  isCustomerPointSelected(selection: Sel, id: number): boolean {
    return selection.customerPoint.includes(id);
  },
  isSingleAsset(selection: Sel): boolean {
    return selection.asset.length === 1 && selection.customerPoint.length === 0;
  },
  isSingleCustomerPoint(selection: Sel): boolean {
    return selection.customerPoint.length === 1 && selection.asset.length === 0;
  },
  /** Id of the single selected asset, or null when not a single-asset selection. */
  singleAssetId(selection: Sel): IWrappedFeature["id"] | null {
    return this.isSingleAsset(selection) ? selection.asset[0] : null;
  },
  /** Id of the single selected customer point, or null otherwise. */
  singleCustomerPointId(selection: Sel): number | null {
    return this.isSingleCustomerPoint(selection)
      ? selection.customerPoint[0]
      : null;
  },
  toggleSingleAsset(selection: Sel, id: IWrappedFeature["id"]): Sel {
    if (this.isSingleAsset(selection) && selection.asset[0] === id) {
      return SELECTION_NONE;
    }
    return this.singleAsset(id);
  },
  addAssetIds(selection: Sel, newIds: IWrappedFeature["id"][]): Sel {
    return rebuild(
      selection,
      unionIds(selection.asset, newIds),
      selection.customerPoint,
    );
  },
  removeAssetIds(selection: Sel, idsToRemove: IWrappedFeature["id"][]): Sel {
    return rebuild(
      selection,
      diffIds(selection.asset, idsToRemove),
      selection.customerPoint,
    );
  },
  fromIds(
    assetIds: readonly number[],
    customerPointIds: readonly number[],
  ): Sel {
    return make(dedupIds(assetIds), dedupIds(customerPointIds));
  },
  applyOperation(
    selection: Sel,
    next: { assetIds: readonly number[]; customerPointIds: readonly number[] },
    operation: "add" | "subtract" | undefined,
  ): Sel {
    if (operation === "add") {
      return rebuild(
        selection,
        unionIds(selection.asset, next.assetIds),
        unionIds(selection.customerPoint, next.customerPointIds),
      );
    }
    if (operation === "subtract") {
      return rebuild(
        selection,
        diffIds(selection.asset, next.assetIds),
        diffIds(selection.customerPoint, next.customerPointIds),
      );
    }
    return this.fromIds(next.assetIds, next.customerPointIds);
  },
  addId(selection: Sel, kind: Category, id: number): Sel {
    const existing =
      kind === "asset" ? selection.asset : selection.customerPoint;
    if (existing.includes(id)) return selection;
    return this.applyOperation(selection, kindedSingleton(kind, id), "add");
  },
  removeId(selection: Sel, kind: Category, id: number): Sel {
    const existing =
      kind === "asset" ? selection.asset : selection.customerPoint;
    if (!existing.includes(id)) return selection;
    return this.applyOperation(
      selection,
      kindedSingleton(kind, id),
      "subtract",
    );
  },
  toggleId(selection: Sel, kind: Category, id: number): Sel {
    const existing =
      kind === "asset" ? selection.asset : selection.customerPoint;
    return existing.includes(id)
      ? this.removeId(selection, kind, id)
      : this.addId(selection, kind, id);
  },
  none(): Sel {
    return SELECTION_NONE;
  },
  singleAsset(id: IWrappedFeature["id"]): Sel {
    return { asset: [id], customerPoint: EMPTY_NUMBER_ARRAY };
  },
  singleCustomerPoint(id: number): Sel {
    return { asset: EMPTY_NUMBER_ARRAY, customerPoint: [id] };
  },
  clearInvalidIds(
    selection: Sel,
    assets: AssetsMap,
    customerPoints: CustomerPoints,
  ): Sel {
    const assetsValid = selection.asset.every((id) => assets.has(id));
    const cpsValid = selection.customerPoint.every((id) =>
      customerPoints.has(id),
    );
    if (assetsValid && cpsValid) return selection;
    return SELECTION_NONE;
  },
};

// Returns `current` unchanged when nothing is added, preserving the reference.
const unionIds = (
  current: readonly number[],
  added: readonly number[],
): readonly number[] => {
  if (added.length === 0) return current;
  const seen = new Set(current);
  const merged = current.slice();
  let changed = false;
  for (const id of added) {
    if (!seen.has(id)) {
      merged.push(id);
      changed = true;
    }
  }
  return changed ? merged : current;
};

// Returns `current` unchanged when nothing is removed, preserving the reference.
const diffIds = (
  current: readonly number[],
  removed: readonly number[],
): readonly number[] => {
  if (removed.length === 0 || current.length === 0) return current;
  const toRemove = new Set(removed);
  const filtered = current.filter((id) => !toRemove.has(id));
  return filtered.length === current.length ? current : filtered;
};

const dedupIds = (ids: readonly number[]): readonly number[] => {
  if (ids.length <= 1) return ids;
  const deduped = new Set<number>(ids);
  if (deduped.size === ids.length) return ids;
  return Array.from(deduped);
};

const kindedSingleton = (
  kind: Category,
  id: number,
): { assetIds: readonly number[]; customerPointIds: readonly number[] } =>
  kind === "asset"
    ? { assetIds: [id], customerPointIds: EMPTY_NUMBER_ARRAY }
    : { assetIds: EMPTY_NUMBER_ARRAY, customerPointIds: [id] };
