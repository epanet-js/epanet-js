import { calculateEqualQuantileBreaks } from "./equal-quantiles";
import { calculateEqualIntervalBreaks } from "./equal-intervals";
import { calculatePrettyBreaks } from "./pretty-breaks";
import { calculateCkmeansBreaks } from "./ckmeans";

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

  it("defaults to new values when not enough data", () => {
    const sortedValues = [1, 1, 2, 2, 3, 4, 5, 10, 15];
    const numBreaks = 2;
    const breaks = calculateEqualQuantileBreaks(sortedValues, numBreaks);

    expect(breaks).toEqual([2, expect.closeTo(4.33)]);
  });
});

describe("equal interval breaks", () => {
  it("assign breaks that with equal distance between them", () => {
    const sortedData = [12, 34, 56, 23, 78, 45, 90];
    const numBreaks = 3;
    const breaks = calculateEqualIntervalBreaks(sortedData, numBreaks);
    expect(breaks).toEqual([12, 38, 64]);
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
});

describe("ckmeans", () => {
  it("assigns breaks matching the target breaks", () => {
    const sortedData = [12, 34, 56, 78, 45, 60, 70, 90];
    expect(calculateCkmeansBreaks(sortedData, 2)).toEqual([45, 70]);
    expect(calculateCkmeansBreaks(sortedData, 3)).toEqual([34, 56, 78]);
    expect(calculateCkmeansBreaks(sortedData, 4)).toEqual([34, 56, 70, 90]);
    expect(calculateCkmeansBreaks(sortedData, 5)).toEqual([34, 45, 56, 70, 90]);
    expect(calculateCkmeansBreaks(sortedData, 6)).toEqual([
      34, 45, 56, 70, 78, 90,
    ]);
    expect(calculateCkmeansBreaks(sortedData, 7)).toEqual([
      34, 45, 56, 60, 70, 78, 90,
    ]);
  });
});
