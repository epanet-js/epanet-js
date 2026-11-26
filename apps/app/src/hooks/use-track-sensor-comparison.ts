import { useEffect } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import type { Sensor, SensorReadings } from "src/lib/sensor-data/sensor";
import { stepAlignmentOf } from "src/lib/sensor-data/step-alignment";

export type SensorComparisonSource = "assetPanel" | "sensorsPanel";

const tracked = new WeakMap<Sensor, Set<string>>();

export const useTrackSensorComparison = (
  source: SensorComparisonSource,
  sensor: Sensor | null,
  readings: SensorReadings | undefined,
  assetType: string,
  intervalSeconds: number | null,
) => {
  const userTracking = useUserTracking();

  useEffect(() => {
    if (
      !sensor ||
      !readings ||
      intervalSeconds === null ||
      intervalSeconds <= 0
    )
      return;
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
      alignment: stepAlignmentOf(readings, intervalSeconds),
    });
  }, [source, sensor, readings, assetType, intervalSeconds, userTracking]);
};
