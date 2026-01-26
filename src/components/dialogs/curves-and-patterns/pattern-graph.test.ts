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
});
