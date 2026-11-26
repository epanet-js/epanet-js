import { useEffect } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import type { ImportedSensor } from "src/lib/sensor-data/parse-sensor-data-file";
import { stepAlignmentOf } from "src/lib/sensor-data/step-alignment";

export type SensorComparisonSource = "assetPanel" | "sensorsPanel";

const tracked = new WeakMap<ImportedSensor, Set<string>>();

export const useTrackSensorComparison = (
  source: SensorComparisonSource,
  sensor: ImportedSensor | null,
  assetType: string,
  intervalSeconds: number | null,
) => {
  const userTracking = useUserTracking();

  useEffect(() => {
    if (!sensor || intervalSeconds === null || intervalSeconds <= 0) return;
    const key = `${source}:${intervalSeconds}`;
    const keys = tracked.get(sensor) ?? new Set<string>();
    if (keys.has(key)) return;
    keys.add(key);
    tracked.set(sensor, keys);

    userTracking.capture({
      name: "sensorData.comparedWithSimulation",
      source,
      assetType,
      parameter: sensor.parameter,
      alignment: stepAlignmentOf(sensor, intervalSeconds),
    });
  }, [source, sensor, assetType, intervalSeconds, userTracking]);
};
