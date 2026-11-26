import { atom } from "jotai";
import type {
  Sensor,
  SensorId,
  SensorReadings,
} from "src/lib/sensor-data/sensor";

export const sensorsAtom = atom<Sensor[]>([]);

export const sensorReadingsAtom = atom<ReadonlyMap<SensorId, SensorReadings>>(
  new Map(),
);
