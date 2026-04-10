import { atom } from "jotai";
import type { ResultsReader } from "src/simulation/results-reader";
import type { EPSResultsReader } from "src/simulation";

export const simulationResultsAtom = atom<ResultsReader | null>(null);
export const simulationStepAtom = atom<number | null>(null);

export type SimulationIdle = { status: "idle" };

type ExecutionResult = {
  report: string;
  modelVersion: string;
  settingsVersion: string;
  epsResultsReader?: EPSResultsReader;
};
type PreviousExecutionResult = ExecutionResult;

export type SimulationFinished = {
  status: "success" | "failure" | "warning";
} & ExecutionResult;

export type SimulationRunning =
  | { status: "running" }
  | ({
      status: "running";
    } & PreviousExecutionResult);

export type SimulationState =
  | SimulationIdle
  | SimulationFinished
  | SimulationRunning;

export const initialSimulationState: SimulationIdle = {
  status: "idle",
};

export const simulationAtom = atom<SimulationState>(initialSimulationState);
