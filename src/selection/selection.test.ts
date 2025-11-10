import { describe, it, expect } from "vitest";
import { USelection } from "./selection";

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
