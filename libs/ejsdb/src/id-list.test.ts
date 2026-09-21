import { describe, expect, it } from "vitest";
import { decodeIdList, encodeIdList, isIdListLength } from "./id-list";

describe("id list", () => {
  it("round-trips a list of ids", () => {
    const ids = [1, 2, 3, 500, 123456];

    expect(decodeIdList(encodeIdList(ids))).toEqual(ids);
  });

  it("keeps the order of the ids", () => {
    const ids = [9, 3, 7, 1];

    expect(decodeIdList(encodeIdList(ids))).toEqual(ids);
  });

  it("stores an empty list as nothing", () => {
    expect(encodeIdList([])).toBeNull();
  });

  it("reads a missing list as empty", () => {
    expect(decodeIdList(null)).toEqual([]);
  });

  it("reads a list of no bytes as empty", () => {
    expect(decodeIdList(new Uint8Array(0))).toEqual([]);
  });

  it("writes ids little-endian", () => {
    expect(Array.from(encodeIdList([1])!)).toEqual([1, 0, 0, 0]);
    expect(Array.from(encodeIdList([258])!)).toEqual([2, 1, 0, 0]);
  });

  it("uses four bytes per id", () => {
    expect(encodeIdList([1, 2, 3])!.byteLength).toEqual(12);
  });

  it("round-trips the largest id it can hold", () => {
    const largest = 2 ** 31 - 1;

    expect(decodeIdList(encodeIdList([largest]))).toEqual([largest]);
  });

  it("round-trips a large list", () => {
    const ids = Array.from({ length: 100000 }, (_, index) => index + 1);

    expect(decodeIdList(encodeIdList(ids))).toEqual(ids);
  });

  it("reads a list stored at an offset", () => {
    const encoded = encodeIdList([7, 8])!;
    const padded = new Uint8Array(encoded.byteLength + 1);
    padded.set(encoded, 1);

    const view = padded.subarray(1);

    expect(decodeIdList(view)).toEqual([7, 8]);
  });

  it("refuses an id that is not a whole number", () => {
    expect(() => encodeIdList([1.5])).toThrow(/not a 32-bit integer/);
  });

  it("refuses an id beyond what it can hold", () => {
    expect(() => encodeIdList([2 ** 31])).toThrow(/not a 32-bit integer/);
  });

  it("refuses bytes that do not divide into ids", () => {
    expect(() => decodeIdList(new Uint8Array(6))).toThrow(
      /not a whole number of ids/,
    );
  });

  it("tells whether a byte length holds whole ids", () => {
    expect(isIdListLength(0)).toBe(true);
    expect(isIdListLength(8)).toBe(true);
    expect(isIdListLength(6)).toBe(false);
  });
});
