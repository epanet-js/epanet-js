import { calculatePrettyBreaks, checkPrettyBreaksData } from "./pretty-breaks";
import { calculateCkmeansRange, checkCkmeansData } from "./ckmeans";
import {
  calculateEqualIntervalRange,
  checkEqualIntervalsData,
} from "./equal-intervals";
import {
  calculateEqualQuantilesRange,
  checkEqualQuantilesData,
} from "./equal-quantiles";

describe("quantiles", () => {
  it("assigns equal counts on each bucket", () => {
    const sortedValues = [1, 2, 3, 10, 20, 100, 200, 500, 750];
    const numIntervals = 4;
    const breaks = calculateEqualQuantilesRange(sortedValues, numIntervals);

    expect(breaks).toEqual([1, 3, 20, 200, 750]);
  });

  it("can compute with 3", () => {
    const sortedValues = [1, 1, 2, 2, 3, 4, 5, 10, 15];
    const numIntervals = 3;
    const breaks = calculateEqualQuantilesRange(sortedValues, numIntervals);

    expect(breaks).toEqual([1, 2, expect.closeTo(4.33), 15]);
  });

  it("says when data is valid", () => {
    expect(checkEqualQuantilesData([], 3)).toEqual(false);
    expect(checkEqualQuantilesData([0, 0, 0], 3)).toEqual(false);
    expect(checkEqualQuantilesData([0, 1, 2], 3)).toEqual(true);
  });
});

describe("equal interval breaks", () => {
  it("assign breaks that with equal distance between them", () => {
    const sortedData = [0, 1, 2, 3, 10];
    expect(calculateEqualIntervalRange(sortedData, 4)).toEqual([
      0, 2.5, 5, 7.5, 10,
    ]);
    expect(calculateEqualIntervalRange(sortedData, 5)).toEqual([
      0, 2, 4, 6, 8, 10,
    ]);
  });

  it("says when data is valid", () => {
    expect(checkEqualIntervalsData([])).toEqual(false);
    expect(checkEqualIntervalsData([0, 0])).toEqual(false);
    expect(checkEqualIntervalsData([1, 0])).toEqual(false);
    expect(checkEqualIntervalsData([0, 1])).toEqual(true);
  });
});

describe("pretty breaks", () => {
  it("assigns rounded breaks matching the target breaks", () => {
    const sortedData = [12, 34, 56, 78, 45, 90];
    const numBreaks = 3;
    const breaks = calculatePrettyBreaks(sortedData, numBreaks);
    expect(breaks).toEqual([25, 50, 75]);
  });

  it("can generate breaks with only two values", () => {
    const sortedData = [0, 1];

    expect(calculatePrettyBreaks(sortedData, 3)).toEqual([0.25, 0.5, 0.75]);
    expect(calculatePrettyBreaks(sortedData, 4)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(calculatePrettyBreaks(sortedData, 5)).toEqual([
      0.3, 0.4, 0.5, 0.6, 0.7,
    ]);
    expect(calculatePrettyBreaks(sortedData, 6)).toEqual([
      0.2, 0.3, 0.4, 0.5, 0.6, 0.7,
    ]);
    expect(calculatePrettyBreaks(sortedData, 7)).toEqual([
      0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8,
    ]);
  });

  it("can generate breaks when not starting from a rounded value", () => {
    const sortedData = [1.2, 4.85];

    expect(calculatePrettyBreaks(sortedData, 3)).toEqual([2, 3, 4]);
    expect(calculatePrettyBreaks(sortedData, 4)).toEqual([2.5, 3, 3.5, 4]);
    expect(calculatePrettyBreaks(sortedData, 5)).toEqual([2, 2.5, 3, 3.5, 4]);
    expect(calculatePrettyBreaks(sortedData, 6)).toEqual([
      2, 2.5, 3, 3.5, 4, 4.5,
    ]);
    expect(calculatePrettyBreaks(sortedData, 7)).toEqual([
      1.5, 2, 2.5, 3, 3.5, 4, 4.5,
    ]);
  });

  it("can generate breaks with outliers in big data sets", () => {
    const sortedData = [
      ...Array(10).fill(-50),
      ...Array(200).fill(12),
      ...Array(400).fill(90),
      ...Array(10).fill(1000),
    ];

    const breaks = calculatePrettyBreaks(sortedData, 3);
    expect(breaks).toEqual([25, 50, 75]);
  });

  it("says when data is valid", () => {
    expect(checkPrettyBreaksData([])).toEqual(false);
    expect(checkPrettyBreaksData([0, 0])).toEqual(false);
    expect(checkPrettyBreaksData([0, 1])).toEqual(true);
  });
});

describe("ckmeans", () => {
  it("assigns breaks matching the target breaks", () => {
    const sortedData = [12, 34, 56, 78, 45, 60, 70, 90];
    expect(calculateCkmeansRange(sortedData, 3)).toEqual([12, 34, 56, 78]);
    expect(calculateCkmeansRange(sortedData, 4)).toEqual([12, 34, 56, 70, 90]);
    expect(calculateCkmeansRange(sortedData, 5)).toEqual([
      12, 34, 45, 56, 70, 90,
    ]);
    expect(calculateCkmeansRange(sortedData, 6)).toEqual([
      12, 34, 45, 56, 70, 78, 90,
    ]);
    expect(calculateCkmeansRange(sortedData, 7)).toEqual([
      12, 34, 45, 56, 60, 70, 78, 90,
    ]);
  });

  it("rounds to significant digits", () => {
    const sortedData = [120.4, 340.3, 569.9, 840.2];
    expect(calculateCkmeansRange(sortedData, 3)).toEqual([120, 340, 570, 840]);
  });

  it("says when data is valid", () => {
    expect(checkCkmeansData([0, 1, 2], 3)).toEqual(false);
    expect(checkCkmeansData([0, 1, 1, 2], 3)).toEqual(false);
    expect(checkCkmeansData([0, 1, 2, 3], 3)).toEqual(true);
  });
});
