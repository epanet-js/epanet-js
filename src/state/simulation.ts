import { atom } from "jotai";
import type { ResultsReader } from "src/simulation/results-reader";

export const simulationSnapshotAtom = atom<ResultsReader | null>(null);
