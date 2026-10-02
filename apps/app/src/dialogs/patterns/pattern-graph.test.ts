import { colors } from "src/lib/constants";
import { buildPatternData } from "./pattern-graph";

describe("buildPatternData", () => {
  const HOUR = 3600;

  describe("empty pattern", () => {
    it("returns empty arrays for empty pattern", () => {
      const result = buildPatternData([], HOUR, 24 * HOUR);
      expect(result.values).toEqual([]);
      expect(result.labels).toEqual([]);
    });
  });

  describe("steady-state simulation (duration=0)", () => {
    it("shows only first value with active color, rest with inactive color", () => {
      const pattern = [1.0, 0.8, 0.6, 0.4];
      const result = buildPatternData(pattern, HOUR, 0);

      expect(result.values).toHaveLength(4);

      // Only first value is in-duration
      expect(result.values[0].itemStyle.color).toBe(colors.purple500);

      // Rest are out-of-duration
      expect(result.values[1].itemStyle.color).toBe(colors.gray300);
      expect(result.values[2].itemStyle.color).toBe(colors.gray300);
      expect(result.values[3].itemStyle.color).toBe(colors.gray300);
    });

    it("generates time label only for first value", () => {
      const pattern = [1.0, 0.8, 0.6];
      const result = buildPatternData(pattern, HOUR, 0);

      expect(result.labels).toEqual(["0:00", "", ""]);
    });

    it("preserves all pattern values", () => {
      const pattern = [1.0, 0.8, 0.6];
      const result = buildPatternData(pattern, HOUR, 0);

      expect(result.values.map((v) => v.value)).toEqual([1.0, 0.8, 0.6]);
    });
  });

  describe("pattern shorter than duration (cycling required)", () => {
    it("uses different colors for cycled values", () => {
      const pattern = [1.0, 0.8, 0.6];
      const result = buildPatternData(pattern, HOUR, 5 * HOUR);

      expect(result.values).toHaveLength(5);

      // First 3 are original-in-duration
      expect(result.values[0].itemStyle.color).toBe(colors.purple500);
      expect(result.values[1].itemStyle.color).toBe(colors.purple500);
      expect(result.values[2].itemStyle.color).toBe(colors.purple500);

      // Last 2 are cycled
      expect(result.values[3].itemStyle.color).toBe(colors.purple300);
      expect(result.values[4].itemStyle.color).toBe(colors.purple300);
    });

    it("cycles pattern values correctly", () => {
      const pattern = [1.0, 0.8, 0.6];
      const result = buildPatternData(pattern, HOUR, 5 * HOUR);

      expect(result.values.map((v) => v.value)).toEqual([
        1.0, 0.8, 0.6, 1.0, 0.8,
      ]);
    });

    it("generates time labels for whole simulation duration", () => {
      const pattern = [1.0, 0.8, 0.6];
      const result = buildPatternData(pattern, HOUR, 5 * HOUR);

      expect(result.labels).toEqual(["0:00", "1:00", "2:00", "3:00", "4:00"]);
    });
  });

  describe("pattern longer than duration", () => {
    it("uses different colors for values exceeding the simulation duration", () => {
      const pattern = [1.0, 0.8, 0.6, 0.4, 0.5];
      const result = buildPatternData(pattern, HOUR, 3 * HOUR);

      expect(result.values).toHaveLength(5);

      // First 3 are within simulation duration
      expect(result.values[0].itemStyle.color).toBe(colors.purple500);
      expect(result.values[1].itemStyle.color).toBe(colors.purple500);
      expect(result.values[2].itemStyle.color).toBe(colors.purple500);

      // Last 2 are exceeding simulation duration
      expect(result.values[3].itemStyle.color).toBe(colors.gray300);
      expect(result.values[4].itemStyle.color).toBe(colors.gray300);
    });

    it("generates empty time labels for values exceeding simulation duration", () => {
      const pattern = [1.0, 0.8, 0.6, 0.4, 0.5];
      const result = buildPatternData(pattern, HOUR, 3 * HOUR);

      expect(result.labels).toEqual(["0:00", "1:00", "2:00", "", ""]);
    });

    it("preserves all pattern values", () => {
      const pattern = [1.0, 0.8, 0.6, 0.4, 0.5];
      const result = buildPatternData(pattern, HOUR, 3 * HOUR);

      expect(result.values.map((v) => v.value)).toEqual([
        1.0, 0.8, 0.6, 0.4, 0.5,
      ]);
    });
  });

  describe("fractional intervals", () => {
    it("rounds up when duration does not divide evenly", () => {
      const pattern = [1.0, 0.8, 0.6];
      // 2.5 hours = 3 intervals (ceil)
      const result = buildPatternData(pattern, HOUR, 2.5 * HOUR);

      expect(result.values).toHaveLength(3);
      expect(result.labels).toEqual(["0:00", "1:00", "2:00"]);
    });
  });

  describe("highlighted bar indices", () => {
    it("highlights specified indices with fuchsia color", () => {
      const pattern = [1.0, 0.8, 0.6, 0.4];
      const result = buildPatternData(pattern, HOUR, 4 * HOUR, [1, 3]);

      expect(result.values[0].itemStyle.color).toBe(colors.purple500);
      expect(result.values[1].itemStyle.color).toBe(colors.fuchsia500);
      expect(result.values[2].itemStyle.color).toBe(colors.purple500);
      expect(result.values[3].itemStyle.color).toBe(colors.fuchsia500);
    });

    it("expands highlighted indices to cycled occurrences", () => {
      const pattern = [1.0, 0.8, 0.6];
      // 6 bars total: indices 0,1,2 (original) and 3,4,5 (cycled)
      // Highlighting index 1 should also highlight index 4 (1 + 3)
      const result = buildPatternData(pattern, HOUR, 6 * HOUR, [1]);

      expect(result.values[0].itemStyle.color).toBe(colors.purple500);
      expect(result.values[1].itemStyle.color).toBe(colors.fuchsia500);
      expect(result.values[2].itemStyle.color).toBe(colors.purple500);
      expect(result.values[3].itemStyle.color).toBe(colors.purple300);
      expect(result.values[4].itemStyle.color).toBe(colors.fuchsia500);
      expect(result.values[5].itemStyle.color).toBe(colors.purple300);
    });

    it("highlights multiple cycled occurrences", () => {
      const pattern = [1.0, 0.8];
      // 6 bars: 0,1 (original), 2,3,4,5 (cycled)
      // Highlighting index 0 should highlight 0, 2, 4
      const result = buildPatternData(pattern, HOUR, 6 * HOUR, [0]);

      expect(result.values[0].itemStyle.color).toBe(colors.fuchsia500);
      expect(result.values[1].itemStyle.color).toBe(colors.purple500);
      expect(result.values[2].itemStyle.color).toBe(colors.fuchsia500);
      expect(result.values[3].itemStyle.color).toBe(colors.purple300);
      expect(result.values[4].itemStyle.color).toBe(colors.fuchsia500);
      expect(result.values[5].itemStyle.color).toBe(colors.purple300);
    });

    it("returns normal colors when no indices are highlighted", () => {
      const pattern = [1.0, 0.8, 0.6];
      const result = buildPatternData(pattern, HOUR, 3 * HOUR, []);

      expect(result.values[0].itemStyle.color).toBe(colors.purple500);
      expect(result.values[1].itemStyle.color).toBe(colors.purple500);
      expect(result.values[2].itemStyle.color).toBe(colors.purple500);
    });

    it("returns normal colors when highlightedBarIndices is undefined", () => {
      const pattern = [1.0, 0.8, 0.6];
      const result = buildPatternData(pattern, HOUR, 3 * HOUR, undefined);

      expect(result.values[0].itemStyle.color).toBe(colors.purple500);
      expect(result.values[1].itemStyle.color).toBe(colors.purple500);
      expect(result.values[2].itemStyle.color).toBe(colors.purple500);
    });

    it("highlights out-of-duration bars", () => {
      const pattern = [1.0, 0.8, 0.6, 0.4, 0.5];
      // 3 in-duration, 2 out-of-duration
      const result = buildPatternData(pattern, HOUR, 3 * HOUR, [4]);

      expect(result.values[3].itemStyle.color).toBe(colors.gray300);
      expect(result.values[4].itemStyle.color).toBe(colors.fuchsia500);
    });
  });
});
