import { describe, it, expect } from "vitest";
import { sortingFns } from "@tanstack/react-table";
import {
  buildAlphanumericKey,
  compareAlphanumericKeys,
} from "./lazy-sticky-sorted-row-model";

// A spread of values that exercises every branch of table-core's
// `compareAlphanumeric`: pure strings, numeric chunks, mixed, case, version-ish
// strings, raw numbers, and the values that `toString` collapses to "".
const SAMPLES: unknown[] = [
  "apple",
  "Apple",
  "banana",
  "BANANA",
  "item1",
  "item2",
  "item10",
  "item20",
  "item100",
  "1",
  "2",
  "9",
  "10",
  "20",
  "100",
  "a1b2",
  "a1b10",
  "a2b1",
  "",
  "a",
  "ab",
  "abc",
  "1a",
  "a1",
  "10a",
  "a10",
  "v1.2.3",
  "v1.10.0",
  "v1.2.10",
  5,
  10,
  2,
  0,
  -1,
  3.14,
  null,
  undefined,
  NaN,
  Infinity,
  -Infinity,
  true,
  false,
];

// table-core's `alphanumeric` invoked through minimal row stubs.
const tableCoreAlphanumeric = (x: unknown, y: unknown): number =>
  (sortingFns.alphanumeric as (a: unknown, b: unknown, id: string) => number)(
    { getValue: () => x },
    { getValue: () => y },
    "c",
  );

const keyAlphanumeric = (x: unknown, y: unknown): number =>
  compareAlphanumericKeys(
    buildAlphanumericKey(x, true),
    buildAlphanumericKey(y, true),
  );

describe("alphanumeric sort keys", () => {
  it("matches table-core's alphanumeric for every ordered pair (by sign)", () => {
    for (const x of SAMPLES) {
      for (const y of SAMPLES) {
        const expected = Math.sign(tableCoreAlphanumeric(x, y));
        const actual = Math.sign(keyAlphanumeric(x, y));
        expect(
          actual,
          `compare(${JSON.stringify(x)}, ${JSON.stringify(y)})`,
        ).toBe(expected);
      }
    }
  });

  it("produces the same sorted order as table-core", () => {
    const byTableCore = [...SAMPLES].sort(tableCoreAlphanumeric);
    const byKeys = [...SAMPLES].sort(keyAlphanumeric);
    expect(byKeys).toEqual(byTableCore);
  });

  it("orders numeric chunks numerically, not lexicographically", () => {
    const sorted = ["item10", "item2", "item1"].sort(keyAlphanumeric);
    expect(sorted).toEqual(["item1", "item2", "item10"]);
  });
});

// The text strategy precomputes `toString(value).toLowerCase()` and compares
// with table-core's `compareBasic` — mirror that here to guard the key path.
const tableCoreText = (x: unknown, y: unknown): number =>
  (sortingFns.text as (a: unknown, b: unknown, id: string) => number)(
    { getValue: () => x },
    { getValue: () => y },
    "c",
  );

const toSortString = (v: unknown): string =>
  typeof v === "number"
    ? isNaN(v) || v === Infinity || v === -Infinity
      ? ""
      : String(v)
    : typeof v === "string"
      ? v
      : "";

const keyText = (x: unknown, y: unknown): number => {
  const a = toSortString(x).toLowerCase();
  const b = toSortString(y).toLowerCase();
  return a === b ? 0 : a > b ? 1 : -1;
};

describe("text sort keys", () => {
  it("matches table-core's text sort for every ordered pair (by sign)", () => {
    for (const x of SAMPLES) {
      for (const y of SAMPLES) {
        expect(
          Math.sign(keyText(x, y)),
          `compare(${JSON.stringify(x)}, ${JSON.stringify(y)})`,
        ).toBe(Math.sign(tableCoreText(x, y)));
      }
    }
  });
});
