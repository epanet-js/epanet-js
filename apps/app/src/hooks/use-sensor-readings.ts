import { useAtomValue } from "jotai";
import { sensorReadingsAtom } from "src/state/sensor-data";

export const useSensorReadings = () => useAtomValue(sensorReadingsAtom);
