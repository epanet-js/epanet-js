import { colors } from "src/lib/constants";

const MAX_READINGS_AS_POINTS = 40;

export const sensorReadingsStyle = (displayedReadings: number) =>
  displayedReadings > MAX_READINGS_AS_POINTS
    ? ({ type: "line", color: colors.green600 } as const)
    : ({ type: "points", color: colors.green600 } as const);
