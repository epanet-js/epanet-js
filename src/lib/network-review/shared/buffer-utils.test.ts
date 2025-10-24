import { describe, it, expect } from "vitest";
import {
  createBuffer,
  encodeCount,
  decodeCount,
  encodeCoordinates,
  decodeCoordinates,
  encodeNodeId,
  decodeNodeId,
  encodeLink,
  decodeLink,
} from "./buffer-utils";
import { BUFFER_HEADER_SIZE, UINT32_SIZE } from "./constants";

describe("buffer-utils", () => {
  describe("createBuffer", () => {
    it("creates ArrayBuffer when type is array", () => {
      const buffer = createBuffer(100, "array");
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(100);
    });

    it("creates SharedArrayBuffer when type is shared", () => {
      const buffer = createBuffer(100, "shared");
      expect(buffer).toBeInstanceOf(SharedArrayBuffer);
      expect(buffer.byteLength).toBe(100);
    });
  });

  describe("count encoding/decoding", () => {
    it("encodes and decodes count correctly", () => {
      const buffer = createBuffer(BUFFER_HEADER_SIZE, "array");
      const view = new DataView(buffer);

      encodeCount(view, 42);
      const decoded = decodeCount(view);

      expect(decoded).toBe(42);
    });
  });

  describe("coordinates encoding/decoding", () => {
    it("encodes and decodes single coordinate", () => {
      const buffer = createBuffer(100, "array");
      const view = new DataView(buffer);
      const coord = [10.5, 20.3];

      encodeCoordinates([coord], 0, view);
      const decoded = decodeCoordinates(0, view);

      expect(decoded).toEqual(coord);
    });

    it("encodes multiple coordinates", () => {
      const buffer = createBuffer(100, "array");
      const view = new DataView(buffer);
      const coords = [
        [10.5, 20.3],
        [30.1, 40.7],
      ];

      encodeCoordinates(coords, 0, view);

      expect(decodeCoordinates(0, view)).toEqual(coords[0]);
      expect(decodeCoordinates(16, view)).toEqual(coords[1]);
    });
  });

  describe("node ID encoding/decoding", () => {
    it("encodes and decodes node ID", () => {
      const buffer = createBuffer(UINT32_SIZE, "array");
      const view = new DataView(buffer);

      encodeNodeId(0, view, 123);
      const decoded = decodeNodeId(0, view);

      expect(decoded).toBe(123);
    });
  });

  describe("link encoding/decoding", () => {
    it("encodes and decodes link correctly", () => {
      const buffer = createBuffer(UINT32_SIZE * 3, "array");
      const view = new DataView(buffer);

      encodeLink(0, view, 1, 2, 3);
      const decoded = decodeLink(0, view);

      expect(decoded).toEqual({ id: 1, startNode: 2, endNode: 3 });
    });
  });
});
