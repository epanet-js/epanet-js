import { calculateEqualQuantileBreaks } from "./modes";

describe("quantiles", () => {
  it("assigns equal counts on each bucket", () => {
    const sortedValues = [1, 2, 3, 10, 20, 100, 200, 500, 750];
    const numBreaks = 4;
    const stops = calculateEqualQuantileBreaks(sortedValues, numBreaks);

    expect(stops).toEqual([
      expect.closeTo(2.6),
      expect.closeTo(12),
      expect.closeTo(84),
      expect.closeTo(320),
    ]);
  });

  it("can compute with 3", () => {
    const sortedValues = [1, 1, 2, 2, 3, 4, 5, 10, 15];
    const numBreaks = 2;
    const stops = calculateEqualQuantileBreaks(sortedValues, numBreaks);

    expect(stops).toEqual([2, expect.closeTo(4.33)]);
  });
});
