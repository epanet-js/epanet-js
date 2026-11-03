import { describe, it, expect } from "vitest";
import { USelection } from "./selection";
import { AssetsMap } from "src/hydraulic-model";
import {
  CustomerPoints,
  type CustomerPoint,
  type Zone,
  type Zones,
} from "@epanet-js/hydraulic-model";
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

const buildZones = (...ids: number[]): Zones =>
  new Map(ids.map((id) => [id, { id } as Zone]));

const noZones = buildZones();

describe("USelection", () => {
  describe("addAssetIds", () => {
    it("adds ids to selection, extends existing, and filters duplicates", () => {
      const noneSelection = USelection.none();
      const result1 = USelection.addAssetIds(noneSelection, [1, 2, 3]);
      expect(USelection.getAssetIds(result1)).toEqual([1, 2, 3]);

      const singleSelection = USelection.singleAsset(1);
      const result2 = USelection.addAssetIds(singleSelection, [2, 3]);
      expect(USelection.getAssetIds(result2)).toEqual([1, 2, 3]);

      const multiSelection = USelection.fromAssetIds([1, 2]);
      const result3 = USelection.addAssetIds(multiSelection, [2, 3, 4]);
      expect(USelection.getAssetIds(result3)).toEqual([1, 2, 3, 4]);

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
        noZones,
      );
      expect(result).toBe(selection);
    });

    it("clears single selection when asset does not exist", () => {
      const selection = USelection.singleAsset(99);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
        noZones,
      );
      expect(USelection.isNone(result)).toBe(true);
    });

    it("returns same multi selection when all assets exist", () => {
      const selection = USelection.fromAssetIds([IDS.J1, IDS.J2]);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
        noZones,
      );
      expect(result).toBe(selection);
    });

    it("clears multi selection when any asset does not exist", () => {
      const selection = USelection.fromAssetIds([IDS.J1, 99]);
      const result = USelection.clearInvalidIds(
        selection,
        assets,
        emptyCustomerPoints,
        noZones,
      );
      expect(USelection.isNone(result)).toBe(true);
    });

    it("returns same customer point selection when it exists", () => {
      const selection = USelection.singleCustomerPoint(IDS.P1);
      const result = USelection.clearInvalidIds(
        selection,
        emptyAssets,
        customerPoints,
        noZones,
      );
      expect(result).toBe(selection);
    });

    it("clears customer point selection when it does not exist", () => {
      const selection = USelection.singleCustomerPoint(99);
      const result = USelection.clearInvalidIds(
        selection,
        emptyAssets,
        customerPoints,
        noZones,
      );
      expect(USelection.isNone(result)).toBe(true);
    });

    it("returns none selection unchanged", () => {
      const none = USelection.none();
      expect(
        USelection.clearInvalidIds(
          none,
          emptyAssets,
          emptyCustomerPoints,
          noZones,
        ),
      ).toBe(none);
    });
  });

  describe("removeAssetIds", () => {
    it("removes ids, handles removal to none and single selection", () => {
      const multiSelection = USelection.fromAssetIds([1, 2, 3, 4]);
      const result1 = USelection.removeAssetIds(multiSelection, [2, 4]);
      expect(USelection.getAssetIds(result1)).toEqual([1, 3]);

      const twoItemSelection = USelection.fromAssetIds([1, 2]);
      const result2 = USelection.removeAssetIds(twoItemSelection, [1, 2]);
      expect(USelection.isNone(result2)).toBe(true);

      const result3 = USelection.removeAssetIds(twoItemSelection, [2]);
      expect(USelection.isSingleAsset(result3)).toBe(true);
      expect(USelection.singleAssetId(result3)).toBe(1);
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
      const mixed = USelection.fromIds([1, 2], [7]);
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
      const mixed = USelection.fromIds([1], [7, 8]);
      expect(USelection.getCustomerPointIds(mixed)).toEqual([7, 8]);
    });

    it("singleAssetId / singleCustomerPointId return ids only for single selections", () => {
      expect(USelection.singleAssetId(USelection.singleAsset(1))).toBe(1);
      expect(USelection.singleAssetId(USelection.fromAssetIds([1, 2]))).toBe(
        null,
      );
      expect(USelection.singleAssetId(USelection.singleCustomerPoint(7))).toBe(
        null,
      );
      expect(
        USelection.singleCustomerPointId(USelection.singleCustomerPoint(7)),
      ).toBe(7);
      expect(
        USelection.singleCustomerPointId(USelection.fromIds([1], [7])),
      ).toBe(null);
    });

    it("countByKind, isEmpty and isSingleCustomerPoint", () => {
      expect(USelection.countByKind(USelection.none())).toEqual({
        assets: 0,
        customerPoints: 0,
        zones: 0,
      });
      expect(USelection.isEmpty(USelection.none())).toBe(true);

      const mixed = USelection.fromIds([1, 2], [7]);
      expect(USelection.countByKind(mixed)).toEqual({
        assets: 2,
        customerPoints: 1,
        zones: 0,
      });
      expect(USelection.isEmpty(mixed)).toBe(false);

      expect(USelection.isSingleCustomerPoint(USelection.singleAsset(1))).toBe(
        false,
      );
      expect(
        USelection.isSingleCustomerPoint(USelection.singleCustomerPoint(7)),
      ).toBe(true);
      // A selection of a single CP and no assets is "single customer point".
      expect(
        USelection.isSingleCustomerPoint(USelection.fromIds([], [7])),
      ).toBe(true);
      expect(USelection.isSingleCustomerPoint(mixed)).toBe(false);
    });
  });

  describe("fromIds", () => {
    it("collapses to none, single asset, single CP, or multi", () => {
      expect(USelection.isNone(USelection.fromIds([], []))).toBe(true);

      const singleAsset = USelection.fromIds([1], []);
      expect(USelection.isSingleAsset(singleAsset)).toBe(true);
      expect(USelection.singleAssetId(singleAsset)).toBe(1);

      const singleCp = USelection.fromIds([], [7]);
      expect(USelection.isSingleCustomerPoint(singleCp)).toBe(true);
      expect(USelection.singleCustomerPointId(singleCp)).toBe(7);

      const mixed = USelection.fromIds([1, 2], [7]);
      expect(USelection.getAssetIds(mixed)).toEqual([1, 2]);
      expect(USelection.getCustomerPointIds(mixed)).toEqual([7]);
    });

    it("dedups duplicate ids in fromAssetIds", () => {
      expect(
        USelection.getAssetIds(USelection.fromAssetIds([1, 1, 2, 2, 3])),
      ).toEqual([1, 2, 3]);
      const single = USelection.fromAssetIds([5, 5, 5]);
      expect(USelection.isSingleAsset(single)).toBe(true);
      expect(USelection.singleAssetId(single)).toBe(5);
    });

    it("dedups duplicate ids in fromIds for each kind", () => {
      const sel = USelection.fromIds([1, 1, 2], [7, 7, 8]);
      expect(USelection.getAssetIds(sel)).toEqual([1, 2]);
      expect(USelection.getCustomerPointIds(sel)).toEqual([7, 8]);

      const singleCp = USelection.fromIds([], [9, 9]);
      expect(USelection.isSingleCustomerPoint(singleCp)).toBe(true);
      expect(USelection.singleCustomerPointId(singleCp)).toBe(9);
    });

    it("countByKind reflects the deduplicated counts", () => {
      const sel = USelection.fromIds([1, 1, 2], [7, 7, 8, 8]);
      expect(USelection.countByKind(sel)).toEqual({
        assets: 2,
        customerPoints: 2,
        zones: 0,
      });
    });
  });

  describe("kinded mutators", () => {
    it("addId for assets and customer points", () => {
      const start = USelection.none();
      const withAsset = USelection.addId(start, "asset", 1);
      expect(USelection.isSingleAsset(withAsset)).toBe(true);
      expect(USelection.singleAssetId(withAsset)).toBe(1);

      const withCp = USelection.addId(withAsset, "customerPoint", 7);
      expect(USelection.getAssetIds(withCp)).toEqual([1]);
      expect(USelection.getCustomerPointIds(withCp)).toEqual([7]);

      // duplicate CP add is a no-op
      expect(USelection.addId(withCp, "customerPoint", 7)).toBe(withCp);
    });

    it("removeId for customer points collapses correctly", () => {
      const mixed = USelection.fromIds([1], [7, 8]);
      const afterRemove = USelection.removeId(mixed, "customerPoint", 7);
      expect(USelection.getAssetIds(afterRemove)).toEqual([1]);
      expect(USelection.getCustomerPointIds(afterRemove)).toEqual([8]);

      const removeLastCp = USelection.removeId(afterRemove, "customerPoint", 8);
      expect(USelection.isSingleAsset(removeLastCp)).toBe(true);
      expect(USelection.singleAssetId(removeLastCp)).toBe(1);

      // removing missing CP is a no-op
      expect(USelection.removeId(removeLastCp, "customerPoint", 99)).toBe(
        removeLastCp,
      );
    });

    it("toggleId switches both kinds", () => {
      const start = USelection.none();
      const afterAdd = USelection.toggleId(start, "customerPoint", 7);
      expect(USelection.isSingleCustomerPoint(afterAdd)).toBe(true);
      expect(USelection.singleCustomerPointId(afterAdd)).toBe(7);

      const afterRemove = USelection.toggleId(afterAdd, "customerPoint", 7);
      expect(USelection.isNone(afterRemove)).toBe(true);

      const afterAssetAdd = USelection.toggleId(start, "asset", 1);
      expect(USelection.isSingleAsset(afterAssetAdd)).toBe(true);
      expect(USelection.singleAssetId(afterAssetAdd)).toBe(1);
    });
  });

  describe("reference stability", () => {
    it("preserves the asset array reference when only customer points change", () => {
      const start = USelection.fromIds([1, 2], [7]);
      const afterCpChange = USelection.addId(start, "customerPoint", 8);

      // The customer point set changed...
      expect(USelection.getCustomerPointIds(afterCpChange)).toEqual([7, 8]);
      expect(USelection.getCustomerPointIds(afterCpChange)).not.toBe(
        USelection.getCustomerPointIds(start),
      );
      // ...but the asset set reference is preserved, so map diffing can detect
      // "assets unchanged" by reference identity.
      expect(USelection.getAssetIds(afterCpChange)).toBe(
        USelection.getAssetIds(start),
      );
    });

    it("preserves the customer point array reference when only assets change", () => {
      const start = USelection.fromIds([1], [7, 8]);
      const afterAssetChange = USelection.addId(start, "asset", 2);

      expect(USelection.getAssetIds(afterAssetChange)).toEqual([1, 2]);
      expect(USelection.getCustomerPointIds(afterAssetChange)).toBe(
        USelection.getCustomerPointIds(start),
      );
    });

    it("returns the same selection object when an operation changes nothing", () => {
      const start = USelection.fromIds([1, 2], [7]);
      expect(USelection.addId(start, "asset", 1)).toBe(start);
      expect(
        USelection.applyOperation(
          start,
          { assetIds: [], customerPointIds: [] },
          "add",
        ),
      ).toBe(start);
    });
  });

  describe("clearInvalidIds (multi with customer points)", () => {
    it("returns same multi when all assets and CPs exist", () => {
      const assets = buildAssetsMap(IDS.J1, IDS.J2);
      const customerPoints = buildCustomerPoints(IDS.P1);
      const selection = USelection.fromIds([IDS.J1, IDS.J2], [IDS.P1]);
      expect(
        USelection.clearInvalidIds(selection, assets, customerPoints, noZones),
      ).toBe(selection);
    });

    it("clears multi when a customer point id is missing", () => {
      const assets = buildAssetsMap(IDS.J1, IDS.J2);
      const customerPoints = buildCustomerPoints();
      const selection = USelection.fromIds([IDS.J1, IDS.J2], [IDS.P1]);
      expect(
        USelection.isNone(
          USelection.clearInvalidIds(
            selection,
            assets,
            customerPoints,
            noZones,
          ),
        ),
      ).toBe(true);
    });
  });

  describe("zones", () => {
    it("selects a single zone", () => {
      const selection = USelection.singleZone(5);

      expect(USelection.isSingleZone(selection)).toBe(true);
      expect(USelection.singleZoneId(selection)).toBe(5);
      expect(USelection.getZoneIds(selection)).toEqual([5]);
      expect(USelection.isZoneSelected(selection, 5)).toBe(true);
      expect(USelection.isNone(selection)).toBe(false);
      expect(USelection.describe(selection)).toBe("single/zone");
    });

    it("counts zones alongside assets and customer points", () => {
      const mixed = USelection.fromIds([1], [7], [5, 5, 6]);

      expect(USelection.countByKind(mixed)).toEqual({
        assets: 1,
        customerPoints: 1,
        zones: 2,
      });
      expect(USelection.describe(mixed)).toBe("multi/mixed");
      expect(USelection.describe(USelection.fromIds([], [], [5, 6]))).toBe(
        "multi/zone",
      );
    });

    it("is no longer a single asset or customer point once a zone is added", () => {
      const asset = USelection.addId(USelection.singleAsset(1), "zone", 5);
      const customerPoint = USelection.addId(
        USelection.singleCustomerPoint(7),
        "zone",
        5,
      );

      expect(USelection.isSingleAsset(asset)).toBe(false);
      expect(USelection.singleAssetId(asset)).toBe(null);
      expect(USelection.isSingleCustomerPoint(customerPoint)).toBe(false);
      expect(USelection.isSingleZone(asset)).toBe(false);
    });

    it("adds, removes and toggles zones", () => {
      const withZone = USelection.toggleId(USelection.none(), "zone", 5);
      expect(USelection.isSingleZone(withZone)).toBe(true);
      expect(USelection.addId(withZone, "zone", 5)).toBe(withZone);

      const twoZones = USelection.addId(withZone, "zone", 6);
      expect(USelection.getZoneIds(twoZones)).toEqual([5, 6]);

      const backToOne = USelection.removeId(twoZones, "zone", 6);
      expect(USelection.singleZoneId(backToOne)).toBe(5);
      expect(USelection.isNone(USelection.toggleId(backToOne, "zone", 5))).toBe(
        true,
      );
    });

    it("keeps the other kinds' references when only zones change", () => {
      const start = USelection.fromIds([1], [7]);
      const afterZoneChange = USelection.addId(start, "zone", 5);

      expect(USelection.getAssetIds(afterZoneChange)).toBe(
        USelection.getAssetIds(start),
      );
      expect(USelection.getCustomerPointIds(afterZoneChange)).toBe(
        USelection.getCustomerPointIds(start),
      );
    });

    it("keeps the zone reference when only assets change", () => {
      const start = USelection.fromIds([1], [], [5]);
      const afterAssetChange = USelection.addId(start, "asset", 2);

      expect(USelection.getZoneIds(afterAssetChange)).toBe(
        USelection.getZoneIds(start),
      );
    });

    it("clears the selection when a selected zone does not exist", () => {
      const assets = buildAssetsMap(IDS.J1);
      const selection = USelection.fromIds([IDS.J1], [], [5]);

      expect(
        USelection.clearInvalidIds(
          selection,
          assets,
          buildCustomerPoints(),
          buildZones(5),
        ),
      ).toBe(selection);
      expect(
        USelection.isNone(
          USelection.clearInvalidIds(
            selection,
            assets,
            buildCustomerPoints(),
            buildZones(6),
          ),
        ),
      ).toBe(true);
    });
  });
});
