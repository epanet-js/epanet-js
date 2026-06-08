import type { Category, Sel, SelSingle } from "./types";
import type { IWrappedFeature } from "src/types";
import type { HydraulicModel, AssetsMap } from "src/hydraulic-model";
import { type CustomerPoints } from "@epanet-js/hydraulic-model";
import { EMPTY_ARRAY } from "src/lib/constants";

type SelectionData = {
  selection: Sel;
  hydraulicModel: HydraulicModel;
};

const EMPTY_NUMBER_ARRAY: readonly number[] = EMPTY_ARRAY;

const buildMultiIds = (
  assetIds: readonly number[],
  customerPointIds: readonly number[],
): SelMulti["ids"] => {
  const ids: { -readonly [K in Category]?: readonly number[] } = {};
  if (assetIds.length > 0) ids.asset = assetIds;
  if (customerPointIds.length > 0) ids.customerPoint = customerPointIds;
  return ids;
};

type SelMulti = Extract<Sel, { type: "multi" }>;

export const USelection = {
  /**
   * Return asset ids in the selection (single asset, or assets in a multi).
   * `none` and customer-point-only selections return an empty list.
   */
  getAssetIds(selection: Sel): readonly IWrappedFeature["id"][] {
    switch (selection.type) {
      case "none":
        return EMPTY_NUMBER_ARRAY;
      case "single":
        return selection.kind === "asset" ? [selection.id] : EMPTY_NUMBER_ARRAY;
      case "multi":
        return selection.ids.asset ?? EMPTY_NUMBER_ARRAY;
    }
  },
  /**
   * Return customer point ids in the selection.
   */
  getCustomerPointIds(selection: Sel): readonly number[] {
    switch (selection.type) {
      case "none":
        return EMPTY_NUMBER_ARRAY;
      case "single":
        return selection.kind === "customerPoint"
          ? [selection.id]
          : EMPTY_NUMBER_ARRAY;
      case "multi":
        return selection.ids.customerPoint ?? EMPTY_NUMBER_ARRAY;
    }
  },
  countByKind(selection: Sel): { assets: number; customerPoints: number } {
    return {
      assets: this.getAssetIds(selection).length,
      customerPoints: this.getCustomerPointIds(selection).length,
    };
  },
  isEmpty(selection: Sel): boolean {
    const { assets, customerPoints } = this.countByKind(selection);
    return assets === 0 && customerPoints === 0;
  },
  isNone(selection: Sel): boolean {
    return selection.type === "none";
  },
  /**
   * Short human-readable label for logging/telemetry, e.g.
   * "none" | "single/asset" | "single/customerPoint" |
   * "multi/asset" | "multi/customerPoint" | "multi/mixed".
   */
  describe(selection: Sel): string {
    switch (selection.type) {
      case "none":
        return "none";
      case "single":
        return `single/${selection.kind}`;
      case "multi": {
        const hasAssets = (selection.ids.asset?.length ?? 0) > 0;
        const hasCps = (selection.ids.customerPoint?.length ?? 0) > 0;
        if (hasAssets && hasCps) return "multi/mixed";
        if (hasCps) return "multi/customerPoint";
        return "multi/asset";
      }
    }
  },
  fromAssetIds(ids: readonly IWrappedFeature["id"][]): Sel {
    if (ids.length === 0) return SELECTION_NONE;
    if (ids.length === 1) return this.singleAsset(ids[0]);
    const unique = dedupIds(ids);
    if (unique.length === 1) return this.singleAsset(unique[0]);
    return {
      type: "multi",
      ids: buildMultiIds(unique, EMPTY_NUMBER_ARRAY),
    };
  },
  /**
   * Get selected features of a single or multi selection.
   */
  getSelectedAssets({
    selection,
    hydraulicModel,
  }: SelectionData): IWrappedFeature[] {
    if (selection.type === "none") {
      return EMPTY_ARRAY as IWrappedFeature[];
    }
    const features: IWrappedFeature[] = [];
    for (const id of this.getAssetIds(selection)) {
      const feature = hydraulicModel.assets.get(id);
      if (feature) features.push(feature);
    }
    return features;
  },
  isAssetSelected(selection: Sel, id: IWrappedFeature["id"]): boolean {
    switch (selection.type) {
      case "none":
        return false;
      case "single":
        return selection.kind === "asset" && selection.id === id;
      case "multi":
        return selection.ids.asset?.includes(id) ?? false;
    }
  },
  isCustomerPointSelected(selection: Sel, id: number): boolean {
    if (this.isSingleCustomerPoint(selection)) return selection.id === id;
    if (selection.type === "multi")
      return selection.ids.customerPoint?.includes(id) ?? false;
    return false;
  },
  isSingleAsset(selection: Sel): selection is SelSingle & { kind: "asset" } {
    return selection.type === "single" && selection.kind === "asset";
  },
  isSingleCustomerPoint(
    selection: Sel,
  ): selection is SelSingle & { kind: "customerPoint" } {
    return selection.type === "single" && selection.kind === "customerPoint";
  },
  toggleSingleAsset(selection: Sel, id: IWrappedFeature["id"]): Sel {
    if (this.isSingleAsset(selection) && this.isAssetSelected(selection, id)) {
      return this.none();
    }
    return this.singleAsset(id);
  },
  addAssetIds(selection: Sel, newIds: IWrappedFeature["id"][]): Sel {
    const currentIds = this.getAssetIds(selection);
    const currentSet = new Set(currentIds);
    const uniqueNewIds = newIds.filter((id) => !currentSet.has(id));
    if (uniqueNewIds.length === 0) return selection;
    return this.fromAssetIds([...currentIds, ...uniqueNewIds]);
  },
  removeAssetIds(selection: Sel, idsToRemove: IWrappedFeature["id"][]): Sel {
    const currentIds = this.getAssetIds(selection);
    const removeSet = new Set(idsToRemove);
    const remainingIds = currentIds.filter((id) => !removeSet.has(id));
    return this.fromKindedIds(
      remainingIds,
      this.getCustomerPointIds(selection),
    );
  },
  /**
   * Build a selection from asset ids and customer point ids.
   * Collapses to `none` when both lists are empty; preserves the
   * `single` shape when there is exactly one asset (and no CPs),
   * or exactly one customer point (and no assets).
   */
  fromKindedIds(
    assetIds: readonly number[],
    customerPointIds: readonly number[],
  ): Sel {
    if (assetIds.length === 0 && customerPointIds.length === 0) {
      return SELECTION_NONE;
    }
    const uniqueAssetIds = dedupIds(assetIds);
    const uniqueCpIds = dedupIds(customerPointIds);
    if (uniqueCpIds.length === 0 && uniqueAssetIds.length === 1) {
      return this.singleAsset(uniqueAssetIds[0]);
    }
    if (uniqueAssetIds.length === 0 && uniqueCpIds.length === 1) {
      return this.singleCustomerPoint(uniqueCpIds[0]);
    }
    return {
      type: "multi",
      ids: buildMultiIds(uniqueAssetIds, uniqueCpIds),
    };
  },
  /**
   * Apply an add/subtract/replace operation using a pair of kinded id lists.
   * Used by triggers (trace, area-select) that compute fresh asset+CP ids
   * together and want a single setSelection call. `operation === undefined`
   * means replace.
   */
  applyKindedOperation(
    selection: Sel,
    next: { assetIds: readonly number[]; customerPointIds: readonly number[] },
    operation: "add" | "subtract" | undefined,
  ): Sel {
    if (operation === "add") {
      return this.fromKindedIds(
        unionIds(this.getAssetIds(selection), next.assetIds),
        unionIds(this.getCustomerPointIds(selection), next.customerPointIds),
      );
    }
    if (operation === "subtract") {
      return this.fromKindedIds(
        diffIds(this.getAssetIds(selection), next.assetIds),
        diffIds(this.getCustomerPointIds(selection), next.customerPointIds),
      );
    }
    return this.fromKindedIds(next.assetIds, next.customerPointIds);
  },
  addId(selection: Sel, kind: Category, id: number): Sel {
    const existing =
      kind === "asset"
        ? this.getAssetIds(selection)
        : this.getCustomerPointIds(selection);
    if (existing.includes(id)) return selection;
    return this.applyKindedOperation(
      selection,
      kindedSingleton(kind, id),
      "add",
    );
  },
  removeId(selection: Sel, kind: Category, id: number): Sel {
    const existing =
      kind === "asset"
        ? this.getAssetIds(selection)
        : this.getCustomerPointIds(selection);
    if (!existing.includes(id)) return selection;
    return this.applyKindedOperation(
      selection,
      kindedSingleton(kind, id),
      "subtract",
    );
  },
  toggleId(selection: Sel, kind: Category, id: number): Sel {
    const ids =
      kind === "asset"
        ? this.getAssetIds(selection)
        : this.getCustomerPointIds(selection);
    return ids.includes(id)
      ? this.removeId(selection, kind, id)
      : this.addId(selection, kind, id);
  },
  none(): Sel {
    return SELECTION_NONE;
  },
  singleAsset(id: IWrappedFeature["id"]): SelSingle {
    return {
      type: "single",
      kind: "asset",
      id,
    };
  },
  singleCustomerPoint(id: number): SelSingle {
    return {
      type: "single",
      kind: "customerPoint",
      id,
    };
  },
  clearInvalidIds(
    selection: Sel,
    assets: AssetsMap,
    customerPoints: CustomerPoints,
  ): Sel {
    switch (selection.type) {
      case "none":
        return selection;
      case "single":
        if (selection.kind === "asset") {
          return assets.has(selection.id) ? selection : SELECTION_NONE;
        }
        return customerPoints.has(selection.id) ? selection : SELECTION_NONE;
      case "multi": {
        const assetIds = selection.ids.asset ?? EMPTY_NUMBER_ARRAY;
        const cpIds = selection.ids.customerPoint ?? EMPTY_NUMBER_ARRAY;
        const assetsValid = assetIds.every((id) => assets.has(id));
        const cpsValid = cpIds.every((id) => customerPoints.has(id));
        if (assetsValid && cpsValid) return selection;
        return SELECTION_NONE;
      }
    }
  },
};

export const SELECTION_NONE: Sel = {
  type: "none",
};

const unionIds = (
  current: readonly number[],
  added: readonly number[],
): number[] => {
  const seen = new Set(current);
  const merged = current.slice();
  for (const id of added) {
    if (!seen.has(id)) merged.push(id);
  }
  return merged;
};

const diffIds = (
  current: readonly number[],
  removed: readonly number[],
): number[] => {
  if (removed.length === 0) return current.slice();
  const toRemove = new Set(removed);
  return current.filter((id) => !toRemove.has(id));
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
