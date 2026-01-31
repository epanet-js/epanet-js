import { atom } from "jotai";
import type { SimulationFinished } from "src/state/jotai";

export const simulationCacheAtom = atom<Map<string, SimulationFinished>>(
  new Map(),
);
