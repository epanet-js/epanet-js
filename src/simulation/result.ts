import { ResultsReader } from "./results-reader";

export type SimulationStatus = "success" | "failure";

export type SimulationResult = {
  status: SimulationStatus;
  report: string;
  results: ResultsReader;
};
