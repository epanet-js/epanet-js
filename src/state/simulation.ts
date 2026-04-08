import { atom } from "jotai";
import { selectAtom } from "jotai/utils";
import type { ResultsReader } from "src/simulation/results-reader";
import type { EPSResultsReader } from "src/simulation/epanet/eps-results-reader";

export type SimulationStep = {
  resultsReader: ResultsReader;
  currentTimestepIndex: number;
};

export const simulationStepAtom = atom<SimulationStep | null>(null);

export const simulationResultsAtom = selectAtom(
  simulationStepAtom,
  (simulationStep) => simulationStep?.resultsReader ?? null,
);

export const currentTimestepIndexAtom = selectAtom(
  simulationStepAtom,
  (simulationStep) => simulationStep?.currentTimestepIndex ?? null,
);

export type SimulationIdle = { status: "idle" };

export type SimulationSuccess = {
  status: "success" | "warning";
  report: string;
  modelVersion: string;
  settingsVersion: string;
  metadata: ArrayBuffer;
  epsResultsReader: EPSResultsReader;
};

export type SimulationFailure = {
  status: "failure";
  report: string;
  modelVersion: string;
  settingsVersion: string;
  metadata?: ArrayBuffer;
};

export type SimulationFinished = SimulationSuccess | SimulationFailure;

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
