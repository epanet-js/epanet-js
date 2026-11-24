import { colors } from "src/lib/constants";

const MAX_READINGS_AS_POINTS = 40;

export const sensorReadingsStyle = (
  displayedReadings: number,
  color: string = colors.green600,
) =>
  displayedReadings > MAX_READINGS_AS_POINTS
    ? ({ type: "line", color } as const)
    : ({ type: "points", color } as const);

export const readingsUpTo = (times: readonly number[], endSeconds: number) =>
  times.filter((seconds) => seconds <= endSeconds).length;
