import { describe, it, expect } from "vitest";
import type {
  CustomAttribute,
  CustomAttributeValue,
} from "@epanet-js/custom-attributes";
import {
  presets,
  FormattingSpec,
} from "src/lib/project-settings/quantities-spec";
import { buildCustomAttributeStats } from "./custom-attributes-stats";
import type { QuantityStats, CategoryStats } from "./stats";

describe("buildCustomAttributeStats", () => {
  const units = presets.LPS.units;
  const formatting: FormattingSpec = {
    decimals: presets.LPS.decimals,
    defaultDecimals: 3,
  };

  const build = (
    attribute: CustomAttribute,
    valuesById: Array<[number, CustomAttributeValue]>,
  ) => buildCustomAttributeStats(attribute, valuesById, units, formatting);

  const numberAttribute: CustomAttribute = {
    id: "ca-1",
    label: "Age",
    type: "number",
  };
  const textAttribute: CustomAttribute = {
    id: "ca-2",
    label: "Owner",
    type: "text",
  };

  it("aggregates number values into quantity stats", () => {
    const stats = build(numberAttribute, [
      [1, 10],
      [2, 20],
      [3, 30],
    ]) as QuantityStats;

    expect(stats.type).toBe("quantity");
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(30);
    expect(stats.mean).toBe(20);
    expect(stats.sum).toBe(60);
    expect(stats.unit).toBeNull();
    expect(stats.emptyBucket).toBeUndefined();
  });

  it("collects empty number values into an empty bucket", () => {
    const stats = build(numberAttribute, [
      [1, 10],
      [2, null],
      [3, null],
    ]) as QuantityStats;

    expect(stats.values.get(10)).toEqual([1]);
    expect(stats.emptyBucket?.label).toBe("empty");
    expect(stats.emptyBucket?.ids).toEqual([2, 3]);
  });

  it("groups text values into category stats", () => {
    const stats = build(textAttribute, [
      [1, "Alice"],
      [2, "Bob"],
      [3, "Alice"],
    ]) as CategoryStats;

    expect(stats.type).toBe("category");
    expect(stats.values.get("Alice")).toEqual([1, 3]);
    expect(stats.values.get("Bob")).toEqual([2]);
  });

  it("collects empty text values into an empty bucket", () => {
    const stats = build(textAttribute, [
      [1, "Alice"],
      [2, null],
    ]) as CategoryStats;

    expect(stats.values.get("Alice")).toEqual([1]);
    expect(stats.emptyBucket?.label).toBe("empty");
    expect(stats.emptyBucket?.ids).toEqual([2]);
  });
});
