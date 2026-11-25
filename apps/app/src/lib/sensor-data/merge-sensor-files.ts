import type { ImportError } from "src/lib/operational-data-io/import-result";
import type {
  ImportedSensor,
  ParseSensorDataResult,
} from "./parse-sensor-data-file";

export type SensorFile = {
  name: string;
  result: Pick<ParseSensorDataResult, "sensors" | "columns">;
};

export type MergedSensors = {
  sensors: ImportedSensor[];
  sensorsByFile: ImportedSensor[][];
  errorsByFile: ImportError[][];
  skippedByFile: ReadonlySet<string>[];
};

export const mergeSensorFiles = (files: SensorFile[]): MergedSensors => {
  const sensors: ImportedSensor[] = [];
  const fileOfName = new Map<string, string>();
  const assetsInUse = new Set<string>();
  const sensorsByFile = files.map((): ImportedSensor[] => []);
  const errorsByFile = files.map((): ImportError[] => []);
  const skippedByFile = files.map(() => new Set<string>());

  files.forEach(({ name: fileName, result }, file) => {
    for (const sensor of result.sensors) {
      const column = result.columns.get(sensor.name);
      const nameKey = sensor.name.toLowerCase();
      const assetKey = `${sensor.assetId}:${sensor.parameter}`;
      const skip = (code: string, params?: string[]) => {
        errorsByFile[file].push({
          label: sensor.name,
          code,
          ...(params ? { params } : {}),
          ...(column === undefined ? {} : { column }),
        });
        skippedByFile[file].add(sensor.name);
      };

      const earlierFile = fileOfName.get(nameKey);
      if (earlierFile !== undefined) {
        skip("repeatedSensor", [earlierFile]);
        continue;
      }
      if (assetsInUse.has(assetKey)) {
        skip("duplicateSensorOnAsset");
        continue;
      }

      fileOfName.set(nameKey, fileName);
      assetsInUse.add(assetKey);
      sensors.push(sensor);
      sensorsByFile[file].push(sensor);
    }
  });

  return { sensors, sensorsByFile, errorsByFile, skippedByFile };
};
