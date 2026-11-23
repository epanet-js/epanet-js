import type { Timing } from "@epanet-js/simulation";
import type { ImportError } from "src/lib/operational-data-io/import-result";
import type { ImportedSensor } from "./parse-sensor-data-file";

type TimedSensor = Pick<ImportedSensor, "name" | "readings">;

export const checkSensorTiming = (
  sensors: TimedSensor[],
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
