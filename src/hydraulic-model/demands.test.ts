import { describe, it, expect } from "vitest";
import { getNextPatternId, DemandPatterns } from "./demands";

const createPatterns = (
  entries: Array<{ id: number; label: string; multipliers: number[] }>,
): DemandPatterns => {
  return new Map(entries.map((e) => [e.id, e]));
};

describe("getNextPatternId", () => {
  describe("without startId", () => {
    it("returns 1 for empty patterns", () => {
      const patterns: DemandPatterns = new Map();
      expect(getNextPatternId(patterns)).toBe(1);
    });

    it("returns next available id after existing patterns", () => {
      const patterns = createPatterns([
        { id: 1, label: "P1", multipliers: [1] },
        { id: 2, label: "P2", multipliers: [1] },
      ]);
      expect(getNextPatternId(patterns)).toBe(3);
    });

    it("fills gaps in id sequence", () => {
      const patterns = createPatterns([
        { id: 1, label: "P1", multipliers: [1] },
        { id: 3, label: "P3", multipliers: [1] },
      ]);
      // Without startId, it should start from a low number and find the first gap
      expect(getNextPatternId(patterns)).toBe(2);
    });
  });

  describe("with startId", () => {
    it("returns startId if not in use", () => {
      const patterns = createPatterns([
        { id: 1, label: "P1", multipliers: [1] },
      ]);
      expect(getNextPatternId(patterns, 5)).toBe(5);
    });

    it("increments from startId until finding unused id", () => {
      const patterns = createPatterns([
        { id: 1, label: "P1", multipliers: [1] },
        { id: 2, label: "P2", multipliers: [1] },
        { id: 3, label: "P3", multipliers: [1] },
      ]);
      expect(getNextPatternId(patterns, 1)).toBe(4);
    });

    it("returns startId when patterns is empty", () => {
      const patterns: DemandPatterns = new Map();
      expect(getNextPatternId(patterns, 10)).toBe(10);
    });

    it("returns 1 when startId is 0", () => {
      const patterns: DemandPatterns = new Map();
      expect(getNextPatternId(patterns, 0)).toBe(1);
    });

    it("handles non-sequential ids correctly", () => {
      const patterns = createPatterns([
        { id: 5, label: "P5", multipliers: [1] },
        { id: 10, label: "P10", multipliers: [1] },
      ]);
      expect(getNextPatternId(patterns, 5)).toBe(6);
    });
  });
});
