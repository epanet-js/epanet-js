import { RangeMode } from "../range-symbology";
import { checkCkmeansData } from "./ckmeans";
import { checkEqualIntervalsData } from "./equal-intervals";
import { checkEqualQuantilesData } from "./equal-quantiles";
import { checkPrettyBreaksData } from "./pretty-breaks";

export { calculatePrettyBreaks } from "./pretty-breaks";

export const checkValidData = (
  mode: RangeMode,
  sortedData: number[],
  numIntervals: number,
) => {
  switch (mode) {
    case "equalIntervals":
      return checkEqualIntervalsData(sortedData);
    case "equalQuantiles":
      return checkEqualQuantilesData(sortedData, numIntervals);
    case "prettyBreaks":
      return checkPrettyBreaksData(sortedData);
    case "ckmeans":
      return checkCkmeansData(sortedData, numIntervals);
    case "manual":
      return true;
  }
};
