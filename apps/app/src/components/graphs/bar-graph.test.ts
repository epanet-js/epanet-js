import { calculateInterval } from "./bar-graph";

describe("calculateInterval", () => {
  describe("startAtZero = true (default bar-graph behavior)", () => {
    it("returns default range for empty values", () => {
      const result = calculateInterval([], true);
      expect(result).toEqual({ min: 0, max: 1, interval: 0.2 });
    });

    it("includes zero in the y-axis range", () => {
      const result = calculateInterval([2, 4, 6], true);
      expect(result.min).toBeLessThanOrEqual(0);
    });

    it("includes at least 1 in the y-axis max", () => {
      const result = calculateInterval([0.1, 0.2], true);
      expect(result.max).toBeGreaterThanOrEqual(1);
    });

    it("handles typical demand multipliers around 1.0", () => {
      const result = calculateInterval([0.8, 1.0, 1.2, 1.4, 1.0, 0.6], true);
      expect(result.min).toBeLessThanOrEqual(0);
      expect(result.max).toBeGreaterThanOrEqual(1.4);
      expect(result.interval).toBeGreaterThan(0);
    });
  });

  describe("startAtZero = false (reservoir head patterns)", () => {
    it("returns default range for empty values", () => {
      const result = calculateInterval([], false);
      expect(result).toEqual({ min: 0, max: 1, interval: 0.2 });
    });

    it("does not force zero in the range", () => {
      const result = calculateInterval([100, 102, 101, 103], false);
      expect(result.min).toBeGreaterThan(0);
    });

    it("adds padding around the data range", () => {
      const values = [100, 102, 101, 103];
      const result = calculateInterval(values, false);
      const dataRange = 103 - 100;
      // At least 30% padding on each side
      expect(result.min).toBeLessThanOrEqual(100 - dataRange * 0.3);
      expect(result.max).toBeGreaterThanOrEqual(103 + dataRange * 0.3);
    });

    it("handles all identical values", () => {
      const result = calculateInterval([50, 50, 50], false);
      expect(result.min).toBeLessThan(50);
      expect(result.max).toBeGreaterThan(50);
      expect(result.interval).toBeGreaterThan(0);
    });

    it("handles single value", () => {
      const result = calculateInterval([75], false);
      expect(result.min).toBeLessThan(75);
      expect(result.max).toBeGreaterThan(75);
      expect(result.interval).toBeGreaterThan(0);
    });

    it("makes small variations around a large value clearly visible", () => {
      // Reservoir head: values around 200m with ±1m variation
      const values = [199.5, 200.0, 200.5, 200.2, 199.8];
      const result = calculateInterval(values, false);
      // The range should be small enough to see the variation
      const axisRange = result.max - result.min;
      expect(axisRange).toBeLessThan(10);
      // All values must be within the range
      expect(result.min).toBeLessThanOrEqual(199.5);
      expect(result.max).toBeGreaterThanOrEqual(200.5);
    });

    it("contains all data points within min/max", () => {
      const values = [95.3, 100.7, 98.2, 102.1, 97.5];
      const result = calculateInterval(values, false);
      expect(result.min).toBeLessThanOrEqual(95.3);
      expect(result.max).toBeGreaterThanOrEqual(102.1);
    });

    it("handles negative values", () => {
      const values = [-5.5, -3.2, -4.1];
      const result = calculateInterval(values, false);
      expect(result.min).toBeLessThanOrEqual(-5.5);
      expect(result.max).toBeGreaterThanOrEqual(-3.2);
      expect(result.interval).toBeGreaterThan(0);
    });
  });
});
