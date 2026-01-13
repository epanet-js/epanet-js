import { calculateInterval } from "./quick-graph-chart";

describe("calculateInterval", () => {
  describe("edge cases", () => {
    it("returns zeros for empty values array", () => {
      const result = calculateInterval(2, []);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(0);
      expect(result.interval).toBeCloseTo(0);
    });

    it("handles single value", () => {
      const result = calculateInterval(2, [5.5]);
      expect(result.min).toBeCloseTo(5.3);
      expect(result.max).toBeCloseTo(5.7);
      expect(result.interval).toBeCloseTo(0.1);
    });

    it("handles all identical values", () => {
      const result = calculateInterval(2, [10, 10, 10, 10]);
      expect(result.min).toBeCloseTo(9.8);
      expect(result.max).toBeCloseTo(10.1);
      expect(result.interval).toBeCloseTo(0.1);
    });
  });

  describe("respects decimal precision", () => {
    it("rounds min down and max up to specified decimals", () => {
      const result = calculateInterval(2, [1.234, 5.678]);
      expect(result.min).toBeCloseTo(1);
      expect(result.max).toBeCloseTo(6);
      expect(result.interval).toBeCloseTo(1);
    });

    it("handles 0 decimals", () => {
      const result = calculateInterval(0, [1.5, 8.7]);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(20);
      expect(result.interval).toBeCloseTo(10);
    });

    it("handles high precision (3 decimals)", () => {
      const result = calculateInterval(3, [0.1234, 0.5678]);
      expect(result.min).toBeCloseTo(0.1);
      expect(result.max).toBeCloseTo(0.6);
      expect(result.interval).toBeCloseTo(0.1);
    });
  });

  describe("nice interval calculation", () => {
    it("produces a nice interval for typical pressure values", () => {
      const result = calculateInterval(2, [10.5, 15.2, 12.8, 14.1]);
      expect(result.min).toBeCloseTo(10);
      expect(result.max).toBeCloseTo(16);
      expect(result.interval).toBeCloseTo(1);
    });

    it("produces appropriate interval for large range", () => {
      const result = calculateInterval(0, [0, 100, 50, 75, 25]);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(100);
      expect(result.interval).toBeCloseTo(25);
    });

    it("produces appropriate interval for small range", () => {
      const result = calculateInterval(2, [10.01, 10.02, 10.03, 10.04]);
      expect(result.min).toBeCloseTo(9.9);
      expect(result.max).toBeCloseTo(10.2);
      expect(result.interval).toBeCloseTo(0.1);
    });
  });

  describe("min/max boundaries", () => {
    it("includes all data points within min/max", () => {
      const values = [3.7, 8.2, 5.1, 6.9, 4.3];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(4);
      expect(result.max).toBeCloseTo(7);
      expect(result.interval).toBeCloseTo(1);
    });

    it("handles negative values", () => {
      const values = [-5.5, -2.3, 1.2, 4.8];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(-7.5);
      expect(result.max).toBeCloseTo(5);
      expect(result.interval).toBeCloseTo(2.5);
    });

    it("handles all negative values", () => {
      const values = [-10.5, -8.2, -5.1, -3.7];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(-12);
      expect(result.max).toBeCloseTo(-2);
      expect(result.interval).toBeCloseTo(2);
    });
  });

  describe("interval count", () => {
    it("produces roughly the target number of intervals", () => {
      const values = [0, 100];
      const result = calculateInterval(0, values, 5);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(100);
      expect(result.interval).toBeCloseTo(25);
    });

    it("respects custom target interval count of 3", () => {
      const values = [0, 100];
      const result = calculateInterval(0, values, 3);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(100);
      expect(result.interval).toBeCloseTo(50);
    });

    it("respects custom target interval count of 7", () => {
      const values = [0, 100];
      const result = calculateInterval(0, values, 7);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(100);
      expect(result.interval).toBeCloseTo(20);
    });
  });

  describe("real-world scenarios", () => {
    it("handles flow values (typical range 0-50 L/s)", () => {
      const values = [5.2, 12.8, 8.4, 15.1, 3.7, 22.5];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(25);
      expect(result.interval).toBeCloseTo(5);
    });

    it("handles pressure values (typical range 20-80 psi)", () => {
      const values = [45.32, 52.18, 48.76, 51.03, 47.55];
      const result = calculateInterval(2, values);
      expect(result.min).toBeCloseTo(44);
      expect(result.max).toBeCloseTo(54);
      expect(result.interval).toBeCloseTo(2);
    });

    it("handles velocity values (small numbers)", () => {
      const values = [0.52, 0.78, 0.65, 0.91, 0.43];
      const result = calculateInterval(2, values);
      expect(result.min).toBeCloseTo(0.5);
      expect(result.max).toBeCloseTo(0.8);
      expect(result.interval).toBeCloseTo(0.1);
    });

    it("handles tank level values", () => {
      const values = [2.5, 3.8, 4.2, 3.1, 2.9, 4.5, 3.6];
      const result = calculateInterval(1, values);
      expect(result.min).toBeCloseTo(2);
      expect(result.max).toBeCloseTo(5);
      expect(result.interval).toBeCloseTo(1);
    });
  });

  describe("precision edge cases", () => {
    it("handles very small values", () => {
      const values = [0.001, 0.002, 0.003];
      const result = calculateInterval(3, values);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(0.02);
      expect(result.interval).toBeCloseTo(0.01);
    });

    it("handles very large values", () => {
      const values = [1000000, 2000000, 1500000];
      const result = calculateInterval(0, values);
      expect(result.min).toBeCloseTo(1000000);
      expect(result.max).toBeCloseTo(2000000);
      expect(result.interval).toBeCloseTo(250000);
    });

    it("handles mix of zero and positive values", () => {
      const values = [0, 0, 0, 5, 10];
      const result = calculateInterval(0, values);
      expect(result.min).toBeCloseTo(0);
      expect(result.max).toBeCloseTo(20);
      expect(result.interval).toBeCloseTo(10);
    });
  });
});
