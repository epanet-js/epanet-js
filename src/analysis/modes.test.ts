import {
  calculateEqualIntervalBreaks,
  calculateEqualQuantileBreaks,
} from "./modes";

describe("quantiles", () => {
  it("assigns equal counts on each bucket", () => {
    const sortedValues = [1, 2, 3, 10, 20, 100, 200, 500, 750];
    const numBreaks = 4;
    const breaks = calculateEqualQuantileBreaks(sortedValues, numBreaks);

    expect(breaks).toEqual([
      expect.closeTo(2.6),
      expect.closeTo(12),
      expect.closeTo(84),
      expect.closeTo(320),
    ]);
  });

  it("can compute with 3", () => {
    const sortedValues = [1, 1, 2, 2, 3, 4, 5, 10, 15];
    const numBreaks = 2;
    const breaks = calculateEqualQuantileBreaks(sortedValues, numBreaks);

    expect(breaks).toEqual([2, expect.closeTo(4.33)]);
  });
});

describe("equal interval breaks", () => {
  it("assign breaks that are round", () => {
    const sortedData = [12, 34, 56, 23, 78, 45, 90];
    const numBreaks = 3;
    const breaks = calculateEqualIntervalBreaks(sortedData, numBreaks);
    expect(breaks).toEqual([12, 38, 64]);
  });
});
