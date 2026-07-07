import { describe, it, expect } from "vitest";
import {
  Accumulator,
  PropertyStats,
  QuantityStats,
  CategoryStats,
  finalizeStats,
  getDistinctBucketCount,
  updateQuantityStats,
  updateCategoryStats,
  updateBooleanStats,
} from "./summary-stats";
import {
  presets,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";

describe("summary-stats accumulators", () => {
  const units = presets.LPS.units;
  const formatting: FormattingSpec = {
    decimals: presets.LPS.decimals,
    defaultDecimals: 3,
  };

  const finalize = (map: Map<string, Accumulator>, property: string) =>
    finalizeStats(map.get(property)!);

  it("counts distinct quantity values, rounding to display precision", () => {
    const map = new Map<string, Accumulator>();
    updateQuantityStats(map, "elevation", 100.0001, units, formatting, 1);
    updateQuantityStats(map, "elevation", 100.0002, units, formatting, 2);
    updateQuantityStats(map, "elevation", 150, units, formatting, 3);

    const stats = finalize(map, "elevation") as QuantityStats;
    // 100.0001 and 100.0002 round to the same displayed value → one distinct
    expect(stats.distinctCount).toBe(2);
    expect(stats.singleValue).toBeNull();
  });

  it("reports the single value when only one distinct is seen", () => {
    const map = new Map<string, Accumulator>();
    updateQuantityStats(map, "elevation", 100, units, formatting, 1);
    updateQuantityStats(map, "elevation", 100, units, formatting, 2);

    const stats = finalize(map, "elevation") as QuantityStats;
    expect(stats.distinctCount).toBe(1);
    expect(stats.singleValue).toBe(100);
  });

  it("counts empties into the empty bucket without ids", () => {
    const map = new Map<string, Accumulator>();
    updateQuantityStats(map, "roughness", 100, units, formatting, 1);
    updateQuantityStats(map, "roughness", undefined, units, formatting, 2, {
      emptyLabel: "none",
    });
    updateQuantityStats(map, "roughness", undefined, units, formatting, 3, {
      emptyLabel: "none",
    });

    const stats = finalize(map, "roughness") as QuantityStats;
    expect(stats.distinctCount).toBe(1);
    expect(stats.emptyBucket?.label).toBe("none");
    expect(stats.emptyBucket?.count).toBe(2);
    expect(getDistinctBucketCount(stats)).toBe(2);
  });

  it("keeps the distinct value set for categories", () => {
    const map = new Map<string, Accumulator>();
    updateCategoryStats(map, "material", "PVC", 1);
    updateCategoryStats(map, "material", "Steel", 2);
    updateCategoryStats(map, "material", "PVC", 3);

    const stats = finalize(map, "material") as CategoryStats;
    expect(stats.distinctCount).toBe(2);
    expect([...stats.distinctValues].sort()).toEqual(["PVC", "Steel"]);
    expect(stats.singleValue).toBeNull();
  });

  it("summarizes booleans as yes/no", () => {
    const map = new Map<string, Accumulator>();
    updateBooleanStats(map, "isEnabled", true, 1);
    updateBooleanStats(map, "isEnabled", true, 2);

    const stats: PropertyStats = finalize(map, "isEnabled");
    expect(stats.type).toBe("boolean");
    expect(stats.distinctCount).toBe(1);
    expect(stats.singleValue).toBe("yes");
  });

  it("does not retain transient sets on finalized stats", () => {
    const map = new Map<string, Accumulator>();
    updateQuantityStats(map, "elevation", 100, units, formatting, 1);
    const stats = finalize(map, "elevation");
    expect(stats).not.toHaveProperty("seen");
  });
});
