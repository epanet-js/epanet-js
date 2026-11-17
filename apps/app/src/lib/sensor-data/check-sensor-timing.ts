import type { Timing } from "@epanet-js/simulation";
import type { ImportError } from "src/lib/operational-data-io/import-result";
import type { ImportedSensor } from "./parse-sensor-data-file";

type TimedSensor = Pick<ImportedSensor, "name" | "readings">;

export const checkSensorTiming = (
  sensors: TimedSensor[],
  timing: Pick<Timing, "duration" | "reportTimestep">,
): ImportError[] => {
  if (timing.duration <= 0) return [];

  return sensors
    .filter(
      (sensor) =>
        (sensor.readings.length - 1) * timing.reportTimestep !==
        timing.duration,
    )
    .map((sensor) => ({
      label: sensor.name,
      code: "readingsDontCoverDuration",
    }));
};
