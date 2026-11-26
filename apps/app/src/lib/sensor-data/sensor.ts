import { nanoid } from "nanoid";
import type { AssetId } from "@epanet-js/hydraulic-model";
import type { SensorParameter } from "./parameters";
import type { ImportedSensor } from "./parse-sensor-data-file";

export type SensorId = string;

export type Sensor = {
  id: SensorId;
  name: string;
  parameter: SensorParameter;
  assetId: AssetId;
};

export type SensorReadings = {
  times: number[];
  values: number[];
};

const nameKey = (name: string) => name.toLowerCase();

export const toStoredSensors = (
  imported: ImportedSensor[],
  previous: readonly Sensor[] = [],
) => {
  const previousIds = new Map(
    previous.map(({ id, name }) => [nameKey(name), id]),
  );
  const sensors: Sensor[] = [];
  const readings = new Map<SensorId, SensorReadings>();
  for (const {
    name,
    parameter,
    assetId,
    times,
    readings: values,
  } of imported) {
    const id = previousIds.get(nameKey(name)) ?? nanoid();
    sensors.push({ id, name, parameter, assetId });
    readings.set(id, { times, values });
  }
  return { sensors, readings };
};
