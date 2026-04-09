import { atom } from "jotai";
import type { ResultsReader } from "src/simulation/results-reader";
import type { EPSResultsReader } from "src/simulation";

export const simulationResultsAtom = atom<ResultsReader | null>(null);
export const simulationStepAtom = atom<number | null>(null);

export type SimulationIdle = { status: "idle" };
export type SimulationFinished = {
  status: "success" | "failure" | "warning";
  report: string;
  modelVersion: string;
  settingsVersion: string;
  epsResultsReader?: EPSResultsReader;
};
export type SimulationRunning = {
  status: "running";
};

export type SimulationState =
  | SimulationIdle
  | SimulationFinished
  | SimulationRunning;

export const initialSimulationState: SimulationIdle = {
  status: "idle",
};

export const simulationAtom = atom<SimulationState>(initialSimulationState);
