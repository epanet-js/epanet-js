import type { Timing } from "@epanet-js/simulation";
import type { ImportError } from "src/lib/operational-data-io/import-result";
import type {
  ImportedSensor,
  ParseSensorDataResult,
} from "./parse-sensor-data-file";

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
