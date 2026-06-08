import { describe, it, expect } from "vitest";
import { USelection } from "./selection";
import { AssetsMap } from "src/hydraulic-model";
import { CustomerPoints, type CustomerPoint } from "@epanet-js/hydraulic-model";
import type { Asset } from "src/hydraulic-model";

const IDS = { J1: 1, J2: 2, P1: 3 } as const;

const buildAssetsMap = (...ids: number[]) => {
  const map = new AssetsMap();
  for (const id of ids) {
    map.set(id, { id } as Asset);
  }
  return map;
};

const buildCustomerPoints = (...ids: number[]) => {
  const map = new CustomerPoints();
  for (const id of ids) {
    map.set(id, { id } as CustomerPoint);
  }
  return map;
};

describe("USelection", () => {
  describe("addAssetIds", () => {
    it("adds ids to selection, extends existing, and filters duplicates", () => {
      // Add to none selection → multi
      const noneSelection = USelection.none();
      const result1 = USelection.addAssetIds(noneSelection, [1, 2, 3]);
      expect(result1).toEqual({ type: "multi", ids: { asset: [1, 2, 3] } });

      // Extend existing selection
      const singleSelection = USelection.singleAsset(1);
      const result2 = USelection.addAssetIds(singleSelection, [2, 3]);
      expect(result2).toEqual({ type: "multi", ids: { asset: [1, 2, 3] } });

      // Filter duplicates
      const multiSelection = USelection.fromAssetIds([1, 2]);
      const result3 = USelection.addAssetIds(multiSelection, [2, 3, 4]);
      expect(result3).toEqual({ type: "multi", ids: { asset: [1, 2, 3, 4] } });

      // All duplicates → returns same selection
      const result4 = USelection.addAssetIds(multiSelection, [1, 2]);
      expect(result4).toBe(multiSelection);
    });
  });

  describe("clearInvalidIds", () => {
    const assets = buildAssetsMap(IDS.J1, IDS.J2);
    const customerPoints = buildCustomerPoints(IDS.P1);
    const emptyAssets = buildAssetsMap();
    const emptyCustomerPoints = buildCustomerPoints();

    it("returns same single selection when asset exists", () => {
      const selection = USelection.singleAsset(IDS.J1);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
      );
      expect(result).toBe(selection);
    });

    it("clears single selection when asset does not exist", () => {
      const selection = USelection.singleAsset(99);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
      );
      expect(result).toEqual({ type: "none" });
    });

    it("returns same multi selection when all assets exist", () => {
      const selection = USelection.fromAssetIds([IDS.J1, IDS.J2]);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
      );
      expect(result).toBe(selection);
    });

    it("clears multi selection when any asset does not exist", () => {
      const selection = USelection.fromAssetIds([IDS.J1, 99]);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
      );
      expect(result).toEqual({ type: "none" });
    });

    it("returns same customer point selection when it exists", () => {
      const selection = USelection.singleCustomerPoint(IDS.P1);
      const result = USelection.clearInvalidIds(
        selection,
        emptyAssets,
        customerPoints,
      );
      expect(result).toBe(selection);
    });

    it("clears customer point selection when it does not exist", () => {
      const selection = USelection.singleCustomerPoint(99);
      const result = USelection.clearInvalidIds(
        selection,
        emptyAssets,
        customerPoints,
      );
      expect(result).toEqual({ type: "none" });
    });

    it("returns none selection unchanged", () => {
      const none = USelection.none();
      expect(
        USelection.clearInvalidIds(none, emptyAssets, emptyCustomerPoints),
      ).toBe(none);
    });
  });

  describe("removeAssetIds", () => {
    it("removes ids, handles removal to none and single selection", () => {
      // Remove from multi selection
      const multiSelection = USelection.fromAssetIds([1, 2, 3, 4]);
      const result1 = USelection.removeAssetIds(multiSelection, [2, 4]);
      expect(result1).toEqual({ type: "multi", ids: { asset: [1, 3] } });

      // Remove all → none
      const twoItemSelection = USelection.fromAssetIds([1, 2]);
      const result2 = USelection.removeAssetIds(twoItemSelection, [1, 2]);
      expect(result2).toEqual({ type: "none" });

      // Remove to single
      const result3 = USelection.removeAssetIds(twoItemSelection, [2]);
      expect(result3).toEqual({
        type: "single",
        kind: "asset",
        id: 1,
      });
    });
  });

  describe("kinded accessors", () => {
    it("getAssetIds returns asset ids and ignores customer points", () => {
      expect(USelection.getAssetIds(USelection.none())).toEqual([]);
      expect(USelection.getAssetIds(USelection.singleAsset(1))).toEqual([1]);
      expect(USelection.getAssetIds(USelection.fromAssetIds([1, 2]))).toEqual([
        1, 2,
      ]);
      expect(USelection.getAssetIds(USelection.singleCustomerPoint(7))).toEqual(
        [],
      );
      const mixed = USelection.fromKindedIds([1, 2], [7]);
      expect(USelection.getAssetIds(mixed)).toEqual([1, 2]);
    });

    it("getCustomerPointIds returns CP ids from single and multi", () => {
      expect(USelection.getCustomerPointIds(USelection.none())).toEqual([]);
      expect(USelection.getCustomerPointIds(USelection.singleAsset(1))).toEqual(
        [],
      );
      expect(
        USelection.getCustomerPointIds(USelection.singleCustomerPoint(7)),
      ).toEqual([7]);
      const mixed = USelection.fromKindedIds([1], [7, 8]);
      expect(USelection.getCustomerPointIds(mixed)).toEqual([7, 8]);
    });

    it("countByKind, isEmpty and isSingleCustomerPoint", () => {
      expect(USelection.countByKind(USelection.none())).toEqual({
        assets: 0,
        customerPoints: 0,
      });
      expect(USelection.isEmpty(USelection.none())).toBe(true);

      const mixed = USelection.fromKindedIds([1, 2], [7]);
      expect(USelection.countByKind(mixed)).toEqual({
        assets: 2,
        customerPoints: 1,
      });
      expect(USelection.isEmpty(mixed)).toBe(false);

      expect(USelection.isSingleCustomerPoint(USelection.singleAsset(1))).toBe(
        false,
      );
      expect(
        USelection.isSingleCustomerPoint(USelection.singleCustomerPoint(7)),
      ).toBe(true);
      // fromKindedIds collapses ([], [oneCp]) into a SelSingle of kind customerPoint
      expect(
        USelection.isSingleCustomerPoint(USelection.fromKindedIds([], [7])),
      ).toBe(true);
      expect(USelection.isSingleCustomerPoint(mixed)).toBe(false);
    });
  });

  describe("fromKindedIds", () => {
    it("collapses to none, single asset, single CP, or multi", () => {
      expect(USelection.fromKindedIds([], [])).toEqual({ type: "none" });
      expect(USelection.fromKindedIds([1], [])).toEqual({
        type: "single",
        kind: "asset",
        id: 1,
      });
      expect(USelection.fromKindedIds([], [7])).toEqual({
        type: "single",
        kind: "customerPoint",
        id: 7,
      });
      expect(USelection.fromKindedIds([1, 2], [7])).toEqual({
        type: "multi",
        ids: { asset: [1, 2], customerPoint: [7] },
      });
    });

    it("dedups duplicate ids in fromIds", () => {
      expect(USelection.fromAssetIds([1, 1, 2, 2, 3])).toEqual({
        type: "multi",
        ids: { asset: [1, 2, 3] },
      });
      // Collapses to single when all duplicates resolve to one id.
      expect(USelection.fromAssetIds([5, 5, 5])).toEqual({
        type: "single",
        kind: "asset",
        id: 5,
      });
    });

    it("dedups duplicate ids in fromKindedIds for each kind", () => {
      expect(USelection.fromKindedIds([1, 1, 2], [7, 7, 8])).toEqual({
        type: "multi",
        ids: { asset: [1, 2], customerPoint: [7, 8] },
      });
      // Collapses to single CP when CPs dedup to one and no assets.
      expect(USelection.fromKindedIds([], [9, 9])).toEqual({
        type: "single",
        kind: "customerPoint",
        id: 9,
      });
    });

    it("countByKind reflects the deduplicated counts", () => {
      const sel = USelection.fromKindedIds([1, 1, 2], [7, 7, 8, 8]);
      expect(USelection.countByKind(sel)).toEqual({
        assets: 2,
        customerPoints: 2,
      });
    });
  });

  describe("kinded mutators", () => {
    it("addId for assets and customer points", () => {
      const start = USelection.none();
      const withAsset = USelection.addId(start, "asset", 1);
      expect(withAsset).toEqual({
        type: "single",
        kind: "asset",
        id: 1,
      });

      const withCp = USelection.addId(withAsset, "customerPoint", 7);
      expect(withCp).toEqual({
        type: "multi",
        ids: { asset: [1], customerPoint: [7] },
      });

      // duplicate CP add is a no-op
      expect(USelection.addId(withCp, "customerPoint", 7)).toBe(withCp);
    });

    it("removeId for customer points collapses correctly", () => {
      const mixed = USelection.fromKindedIds([1], [7, 8]);
      const afterRemove = USelection.removeId(mixed, "customerPoint", 7);
      expect(afterRemove).toEqual({
        type: "multi",
        ids: { asset: [1], customerPoint: [8] },
      });

      const removeLastCp = USelection.removeId(afterRemove, "customerPoint", 8);
      expect(removeLastCp).toEqual({
        type: "single",
        kind: "asset",
        id: 1,
      });

      // removing missing CP is a no-op
      expect(USelection.removeId(removeLastCp, "customerPoint", 99)).toBe(
        removeLastCp,
      );
    });

    it("toggleId switches both kinds", () => {
      const start = USelection.none();
      const afterAdd = USelection.toggleId(start, "customerPoint", 7);
      expect(afterAdd).toEqual({
        type: "single",
        kind: "customerPoint",
        id: 7,
      });

      const afterRemove = USelection.toggleId(afterAdd, "customerPoint", 7);
      expect(afterRemove).toEqual({ type: "none" });

      const afterAssetAdd = USelection.toggleId(start, "asset", 1);
      expect(afterAssetAdd).toEqual({
        type: "single",
        kind: "asset",
        id: 1,
      });
    });
  });

  describe("clearInvalidIds (multi with customer points)", () => {
    it("returns same multi when all assets and CPs exist", () => {
      const assets = buildAssetsMap(IDS.J1, IDS.J2);
      const customerPoints = buildCustomerPoints(IDS.P1);
      const selection = USelection.fromKindedIds([IDS.J1, IDS.J2], [IDS.P1]);
      expect(
        USelection.clearInvalidIds(selection, assets, customerPoints),
      ).toBe(selection);
    });

    it("clears multi when a customer point id is missing", () => {
      const assets = buildAssetsMap(IDS.J1, IDS.J2);
      const customerPoints = buildCustomerPoints();
      const selection = USelection.fromKindedIds([IDS.J1, IDS.J2], [IDS.P1]);
      expect(
        USelection.clearInvalidIds(selection, assets, customerPoints),
      ).toEqual({ type: "none" });
    });
  });
});
