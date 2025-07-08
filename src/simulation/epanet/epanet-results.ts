import {
  JunctionSimulation,
  PipeSimulation,
  PumpSimulation,
  ResultsReader,
  TankSimulation,
  ValveSimulation,
} from "../results-reader";

export type SimulationResults = Map<
  string,
  | PipeSimulation
  | ValveSimulation
  | PumpSimulation
  | JunctionSimulation
  | TankSimulation
>;

export class EpanetResultsReader implements ResultsReader {
  private results: SimulationResults;

  constructor(results: SimulationResults) {
    this.results = results;
  }

  getValve(valveId: string): ValveSimulation | null {
    if (!this.results.has(valveId)) return null;

    return this.results.get(valveId) as ValveSimulation;
  }

  getPump(pumpId: string): PumpSimulation | null {
    if (!this.results.has(pumpId)) return null;

    return this.results.get(pumpId) as PumpSimulation;
  }

  getJunction(junctionId: string): JunctionSimulation | null {
    if (!this.results.has(junctionId)) return null;

    return this.results.get(junctionId) as JunctionSimulation;
  }

  getPipe(pipeId: string): PipeSimulation | null {
    if (!this.results.has(pipeId)) return null;

    return this.results.get(pipeId) as PipeSimulation;
  }

  getTank(tankId: string): TankSimulation | null {
    if (!this.results.has(tankId)) return null;

    return this.results.get(tankId) as TankSimulation;
  }
}
