import { atom } from "jotai";
import type { ResultsReaderSource } from "src/simulation";

export const simulationStepAtom = atom<number | null>(null);

export type SimulationIdle = { status: "idle" };

type ExecutionResult = {
  report: string;
  modelVersion: string;
  settingsVersion: string;
  // Either the EPANET extended-period reader or the ptsnet transient reader.
  epsResultsReader?: ResultsReaderSource;
};
type PreviousExecutionResult = ExecutionResult;

export type SimulationFinished = {
  status: "success" | "failure" | "warning" | "stopped";
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
