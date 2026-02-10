import { describe, it, expect } from "vitest";
import { USelection } from "./selection";
import { AssetsMap } from "src/hydraulic-model";
import { CustomerPoints } from "src/hydraulic-model/customer-points";
import type { Asset } from "src/hydraulic-model";
import type { CustomerPoint } from "src/hydraulic-model/customer-points";

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
  describe("addSelectionIds", () => {
    it("adds ids to selection, extends existing, and filters duplicates", () => {
      // Add to none selection → multi
      const noneSelection = USelection.none();
      const result1 = USelection.addSelectionIds(noneSelection, [1, 2, 3]);
      expect(result1).toEqual({ type: "multi", ids: [1, 2, 3] });

      // Extend existing selection
      const singleSelection = USelection.single(1);
      const result2 = USelection.addSelectionIds(singleSelection, [2, 3]);
      expect(result2).toEqual({ type: "multi", ids: [1, 2, 3] });

      // Filter duplicates
      const multiSelection = USelection.fromIds([1, 2]);
      const result3 = USelection.addSelectionIds(multiSelection, [2, 3, 4]);
      expect(result3).toEqual({ type: "multi", ids: [1, 2, 3, 4] });

      // All duplicates → returns same selection
      const result4 = USelection.addSelectionIds(multiSelection, [1, 2]);
      expect(result4).toBe(multiSelection);
    });
  });

  describe("clearInvalidIds", () => {
    const assets = buildAssetsMap(IDS.J1, IDS.J2);
    const customerPoints = buildCustomerPoints(IDS.P1);
    const emptyAssets = buildAssetsMap();
    const emptyCustomerPoints = buildCustomerPoints();

    it("returns same single selection when asset exists", () => {
      const selection = USelection.single(IDS.J1);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
      );
      expect(result).toBe(selection);
    });

    it("clears single selection when asset does not exist", () => {
      const selection = USelection.single(99);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
      );
      expect(result).toEqual({ type: "none" });
    });

    it("returns same multi selection when all assets exist", () => {
      const selection = USelection.fromIds([IDS.J1, IDS.J2]);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
      );
      expect(result).toBe(selection);
    });

    it("clears multi selection when any asset does not exist", () => {
      const selection = USelection.fromIds([IDS.J1, 99]);
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

    it("returns none and folder selections unchanged", () => {
      const none = USelection.none();
      expect(
        USelection.clearInvalidIds(none, emptyAssets, emptyCustomerPoints),
      ).toBe(none);

      const folder = USelection.folder("folder-1");
      expect(
        USelection.clearInvalidIds(folder, emptyAssets, emptyCustomerPoints),
      ).toBe(folder);
    });
  });

  describe("removeSelectionIds", () => {
    it("removes ids, handles removal to none and single selection", () => {
      // Remove from multi selection
      const multiSelection = USelection.fromIds([1, 2, 3, 4]);
      const result1 = USelection.removeSelectionIds(multiSelection, [2, 4]);
      expect(result1).toEqual({ type: "multi", ids: [1, 3] });

      // Remove all → none
      const twoItemSelection = USelection.fromIds([1, 2]);
      const result2 = USelection.removeSelectionIds(twoItemSelection, [1, 2]);
      expect(result2).toEqual({ type: "none" });

      // Remove to single
      const result3 = USelection.removeSelectionIds(twoItemSelection, [2]);
      expect(result3).toEqual({ type: "single", id: 1, parts: [] });
    });
  });
});
