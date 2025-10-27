import { describe, it, expect } from "vitest";
import {
  FixedSizeBufferBuilder,
  FixedSizeBufferView,
  VariableSizeBufferBuilder,
  VariableSizeBufferView,
} from "./buffers";
import {
  DataSize,
  encodeId,
  decodeId,
  encodeIdsList,
  getIdsListSize,
  decodeIdsList,
} from ".";

describe("FixedSizeBufferView", () => {
  it("reads count from buffer header", () => {
    const builder = new FixedSizeBufferBuilder<number>(
      DataSize.number,
      3,
      "array",
      encodeId,
    );
    builder.add(100);
    builder.add(200);
    builder.add(300);

    const buffer = builder.finalize();
    const view = new FixedSizeBufferView<number>(
      buffer,
      DataSize.number,
      decodeId,
    );

    expect(view.count).toBe(3);
  });

  it("decodes records at correct offsets", () => {
    const builder = new FixedSizeBufferBuilder<number>(
      DataSize.number,
      3,
      "array",
      encodeId,
    );
    builder.add(100);
    builder.add(200);
    builder.add(300);

    const buffer = builder.finalize();
    const view = new FixedSizeBufferView<number>(
      buffer,
      DataSize.number,
      decodeId,
    );

    expect(view.getById(0)).toBe(100);
    expect(view.getById(1)).toBe(200);
    expect(view.getById(2)).toBe(300);
  });

  it("iter yields all records in order", () => {
    const builder = new FixedSizeBufferBuilder<number>(
      DataSize.number,
      4,
      "array",
      encodeId,
    );
    builder.add(10);
    builder.add(20);
    builder.add(30);
    builder.add(40);

    const buffer = builder.finalize();
    const view = new FixedSizeBufferView<number>(
      buffer,
      DataSize.number,
      decodeId,
    );

    const items = Array.from(view.iter());
    expect(items).toEqual([10, 20, 30, 40]);
  });

  it("enumerate yields correct [index, record] pairs", () => {
    const builder = new FixedSizeBufferBuilder<number>(
      DataSize.number,
      3,
      "array",
      encodeId,
    );
    builder.add(100);
    builder.add(200);
    builder.add(300);

    const buffer = builder.finalize();
    const view = new FixedSizeBufferView<number>(
      buffer,
      DataSize.number,
      decodeId,
    );

    const pairs = Array.from(view.enumerate());
    expect(pairs).toEqual([
      [0, 100],
      [1, 200],
      [2, 300],
    ]);
  });

  it("getById throws RangeError for out-of-range ID", () => {
    const builder = new FixedSizeBufferBuilder<number>(
      DataSize.number,
      2,
      "array",
      encodeId,
    );
    builder.add(100);
    builder.add(200);

    const buffer = builder.finalize();
    const view = new FixedSizeBufferView<number>(
      buffer,
      DataSize.number,
      decodeId,
    );

    expect(() => view.getById(-1)).toThrow(RangeError);
    expect(() => view.getById(-1)).toThrow(/out of bounds/);
    expect(() => view.getById(2)).toThrow(RangeError);
    expect(() => view.getById(2)).toThrow(/out of bounds/);
    expect(() => view.getById(100)).toThrow(RangeError);
    expect(() => view.getById(100)).toThrow(/out of bounds/);
  });

  it("handles empty buffer", () => {
    const builder = new FixedSizeBufferBuilder<number>(
      DataSize.number,
      0,
      "array",
      encodeId,
    );

    const buffer = builder.finalize();
    const view = new FixedSizeBufferView<number>(
      buffer,
      DataSize.number,
      decodeId,
    );

    expect(view.count).toBe(0);
    expect(Array.from(view.iter())).toEqual([]);
    expect(Array.from(view.enumerate())).toEqual([]);
  });
});

describe("VariableSizeBufferView", () => {
  it("reads count from data buffer header", () => {
    const lists = [
      [0, 1, 2],
      [3, 4],
    ];
    const totalSize = lists.reduce(
      (sum, list) => sum + getIdsListSize(list),
      0,
    );

    const builder = new VariableSizeBufferBuilder(
      lists.length,
      totalSize,
      "array",
      encodeIdsList,
      getIdsListSize,
    );
    lists.forEach((list) => builder.add(list));

    const bufferWithIndex = builder.finalize();
    const view = new VariableSizeBufferView(bufferWithIndex, decodeIdsList);

    expect(view.count).toBe(2);
  });

  it("reads offsets from index buffer at correct positions", () => {
    const lists = [
      [0, 1, 2],
      [3, 4],
    ];
    const totalSize = lists.reduce(
      (sum, list) => sum + getIdsListSize(list),
      0,
    );

    const builder = new VariableSizeBufferBuilder(
      lists.length,
      totalSize,
      "array",
      encodeIdsList,
      getIdsListSize,
    );
    lists.forEach((list) => builder.add(list));

    const bufferWithIndex = builder.finalize();
    const view = new VariableSizeBufferView(bufferWithIndex, decodeIdsList);

    expect(view.getById(0)).toEqual([0, 1, 2]);
    expect(view.getById(1)).toEqual([3, 4]);
  });

  it("iter yields all variable-length records in order", () => {
    const lists = [[0, 1, 2], [3, 4], [], [5]];
    const totalSize = lists.reduce(
      (sum, list) => sum + getIdsListSize(list),
      0,
    );

    const builder = new VariableSizeBufferBuilder(
      lists.length,
      totalSize,
      "array",
      encodeIdsList,
      getIdsListSize,
    );
    lists.forEach((list) => builder.add(list));

    const bufferWithIndex = builder.finalize();
    const view = new VariableSizeBufferView(bufferWithIndex, decodeIdsList);

    const items = Array.from(view.iter());
    expect(items).toEqual([[0, 1, 2], [3, 4], [], [5]]);
  });

  it("enumerate yields correct [index, record] pairs", () => {
    const lists = [
      [0, 1],
      [2, 3, 4],
    ];
    const totalSize = lists.reduce(
      (sum, list) => sum + getIdsListSize(list),
      0,
    );

    const builder = new VariableSizeBufferBuilder(
      lists.length,
      totalSize,
      "array",
      encodeIdsList,
      getIdsListSize,
    );
    lists.forEach((list) => builder.add(list));

    const bufferWithIndex = builder.finalize();
    const view = new VariableSizeBufferView(bufferWithIndex, decodeIdsList);

    const pairs = Array.from(view.enumerate());
    expect(pairs).toEqual([
      [0, [0, 1]],
      [1, [2, 3, 4]],
    ]);
  });

  it("getById throws RangeError for out-of-range ID", () => {
    const lists = [
      [0, 1, 2],
      [3, 4],
    ];
    const totalSize = lists.reduce(
      (sum, list) => sum + getIdsListSize(list),
      0,
    );

    const builder = new VariableSizeBufferBuilder(
      lists.length,
      totalSize,
      "array",
      encodeIdsList,
      getIdsListSize,
    );
    lists.forEach((list) => builder.add(list));

    const bufferWithIndex = builder.finalize();
    const view = new VariableSizeBufferView(bufferWithIndex, decodeIdsList);

    expect(() => view.getById(-1)).toThrow(RangeError);
    expect(() => view.getById(-1)).toThrow(/out of bounds/);
    expect(() => view.getById(2)).toThrow(RangeError);
    expect(() => view.getById(2)).toThrow(/out of bounds/);
    expect(() => view.getById(100)).toThrow(RangeError);
    expect(() => view.getById(100)).toThrow(/out of bounds/);
  });

  it("handles empty buffer", () => {
    const builder = new VariableSizeBufferBuilder(
      0,
      0,
      "array",
      encodeIdsList,
      getIdsListSize,
    );

    const bufferWithIndex = builder.finalize();
    const view = new VariableSizeBufferView(bufferWithIndex, decodeIdsList);

    expect(view.count).toBe(0);
    expect(Array.from(view.iter())).toEqual([]);
    expect(Array.from(view.enumerate())).toEqual([]);
  });

  it("handles variable-length data with empty arrays", () => {
    const lists = [[], [1, 2], [], []];
    const totalSize = lists.reduce(
      (sum, list) => sum + getIdsListSize(list),
      0,
    );

    const builder = new VariableSizeBufferBuilder(
      lists.length,
      totalSize,
      "array",
      encodeIdsList,
      getIdsListSize,
    );
    lists.forEach((list) => builder.add(list));

    const bufferWithIndex = builder.finalize();
    const view = new VariableSizeBufferView(bufferWithIndex, decodeIdsList);

    const items = Array.from(view.iter());
    expect(items).toEqual([[], [1, 2], [], []]);
  });
});

describe("Integration: Round-trip encoding/decoding", () => {
  it("VariableSizeBufferBuilder + VariableSizeBufferView round-trip", () => {
    const lists = [[0, 1, 2], [3, 4], [], [5, 6, 7, 8]];
    const totalSize = lists.reduce(
      (sum, list) => sum + getIdsListSize(list),
      0,
    );

    const builder = new VariableSizeBufferBuilder(
      lists.length,
      totalSize,
      "array",
      encodeIdsList,
      getIdsListSize,
    );
    lists.forEach((list) => builder.add(list));

    const bufferWithIndex = builder.finalize();
    const view = new VariableSizeBufferView(bufferWithIndex, decodeIdsList);

    for (let i = 0; i < lists.length; i++) {
      expect(view.getById(i)).toEqual(lists[i]);
    }

    const allItems = Array.from(view.iter());
    expect(allItems).toEqual(lists);
  });

  it("FixedSizeBufferBuilder + FixedSizeBufferView round-trip", () => {
    const ids = [10, 20, 30, 40, 50];

    const builder = new FixedSizeBufferBuilder<number>(
      DataSize.number,
      ids.length,
      "array",
      encodeId,
    );
    ids.forEach((id) => builder.add(id));

    const buffer = builder.finalize();
    const view = new FixedSizeBufferView<number>(
      buffer,
      DataSize.number,
      decodeId,
    );

    for (let i = 0; i < ids.length; i++) {
      expect(view.getById(i)).toBe(ids[i]);
    }

    const allItems = Array.from(view.iter());
    expect(allItems).toEqual(ids);
  });

  it("works with shared buffer type", () => {
    const lists = [
      [0, 1],
      [2, 3, 4],
    ];
    const totalSize = lists.reduce(
      (sum, list) => sum + getIdsListSize(list),
      0,
    );

    const builder = new VariableSizeBufferBuilder(
      lists.length,
      totalSize,
      "shared",
      encodeIdsList,
      getIdsListSize,
    );
    lists.forEach((list) => builder.add(list));

    const bufferWithIndex = builder.finalize();
    const view = new VariableSizeBufferView(bufferWithIndex, decodeIdsList);

    expect(Array.from(view.iter())).toEqual(lists);
    expect(bufferWithIndex.data instanceof SharedArrayBuffer).toBe(true);
    expect(bufferWithIndex.index instanceof SharedArrayBuffer).toBe(true);
  });
});
