import type { Timing } from "@epanet-js/simulation";
import type { ImportError } from "src/lib/operational-data-io/import-result";
import type {
  ImportedSensor,
  ParseSensorDataResult,
} from "./parse-sensor-data-file";
import type { MergedSensors } from "./merge-sensor-files";

export const checkSensorTiming = (
  sensors: Pick<ImportedSensor, "name" | "readings">[],
  timing: Pick<Timing, "duration" | "reportTimestep">,
): ImportError[] => {
  if (timing.duration <= 0) return [];

  const expected = Math.floor(timing.duration / timing.reportTimestep) + 1;

  return sensors
    .filter(
      ({ readings }) =>
        readings.length > expected || readings.length < expected * 0.75,
    )
    .map((sensor) => ({
      label: sensor.name,
      code: "readingsDontCoverDuration",
      params: [String(expected), String(sensor.readings.length)],
    }));
};

export const checkSensorTimes = (
  {
    sensors,
    columns,
  }: {
    sensors: Pick<ImportedSensor, "name" | "times">[];
    columns: ParseSensorDataResult["columns"];
  },
  timing: Pick<Timing, "duration">,
): ImportError[] => {
  if (timing.duration <= 0) return [];
  const earliestEnd = timing.duration * 0.75;

  return sensors
    .filter(({ times = [] }) => (times[times.length - 1] ?? 0) < earliestEnd)
    .map(({ name }) => {
      const column = columns.get(name);
      return {
        label: name,
        code: "readingsEndEarly",
        ...(column === undefined ? {} : { column }),
      };
    });
};

export const checkMergedSensorTimes = (
  {
    sensors,
    errorsByFile,
    lastReadingIn,
  }: Pick<MergedSensors, "sensors" | "errorsByFile" | "lastReadingIn">,
  timing: Pick<Timing, "duration" | "reportTimestep">,
): ImportError[][] =>
  errorsByFile.map((_, file) => {
    const endingHere = sensors.filter(
      ({ name }) => lastReadingIn.get(name)?.file === file,
    );
    const columns = new Map(
      endingHere.flatMap(({ name }): [string, number][] => {
        const column = lastReadingIn.get(name)?.column;
        return column === undefined ? [] : [[name, column]];
      }),
    );
    return checkSensorTimes({ sensors: endingHere, columns }, timing);
  });
