import type { Timing } from "@epanet-js/simulation";
import type { ImportError } from "src/lib/operational-data-io/import-result";
import type { ImportedSensor } from "./parse-sensor-data-file";

export const checkSensorTiming = (
  sensors: Pick<ImportedSensor, "name" | "readings">[],
  timing: Pick<Timing, "duration" | "reportTimestep">,
): ImportError[] => {
  if (timing.duration <= 0) return [];

  const expected = Math.floor(timing.duration / timing.reportTimestep) + 1;

  return sensors
    .filter(
      ({ readings }) =>
        readings.length > expected || readings.length < expected / 2,
    )
    .map((sensor) => ({
      label: sensor.name,
      code: "readingsDontCoverDuration",
      params: [String(expected), String(sensor.readings.length)],
    }));
};

export const checkSensorTimes = (
  sensors: Pick<ImportedSensor, "name" | "times">[],
  timing: Pick<Timing, "duration" | "reportTimestep">,
): ImportError[] => {
  if (timing.duration <= 0) return [];
  const earliestEnd = timing.duration - Math.max(0, timing.reportTimestep);

  return sensors
    .filter(({ times = [] }) => (times[times.length - 1] ?? 0) < earliestEnd)
    .map((sensor) => ({
      label: sensor.name,
      code: "readingsEndEarly",
    }));
};
