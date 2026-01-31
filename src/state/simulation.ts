import { atom } from "jotai";
import type { ResultsReader } from "src/simulation/results-reader";

export const simulationResultsAtom = atom<ResultsReader | null>(null);
