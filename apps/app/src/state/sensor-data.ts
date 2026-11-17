import { atom } from "jotai";
import type { ImportedSensor } from "src/lib/sensor-data/parse-sensor-data-file";

export const sensorsAtom = atom<ImportedSensor[]>([]);
