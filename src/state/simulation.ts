import { atom } from "jotai";
import { selectAtom } from "jotai/utils";
import type { ResultsReader } from "src/simulation/results-reader";
import type { SimulationIds } from "src/simulation/epanet/simulation-metadata";

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
export type SimulationFinished = {
  status: "success" | "failure" | "warning";
  report: string;
  modelVersion: string;
  settingsVersion: string;
  metadata?: ArrayBuffer;
  simulationIds?: SimulationIds;
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
