import type { Getter } from "jotai";
import { initialSimulationState } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";

type SimulationState = import("src/state/simulation").SimulationState;

export type ResultsReader = Awaited<
  ReturnType<import("src/simulation").EPSResultsReader["getResultsForTimestep"]>
> | null;

export async function prepareSimulation(
  get: Getter,
  simulation: SimulationState | null,
  simulationSourceId: string,
): Promise<{
  finalSimulation: SimulationState;
  resultsReader: ResultsReader;
}> {
  const currentSimulation = get(simulationDerivedAtom);
  const preserveTimestepIndex =
    currentSimulation.status === "success" ||
    currentSimulation.status === "warning"
      ? currentSimulation.currentTimestepIndex
      : undefined;

  const resolved = simulation ?? initialSimulationState;
  const { resultsReader, actualTimestepIndex } = await fetchSimulationResults(
    resolved,
    simulationSourceId,
    preserveTimestepIndex,
  );

  const finalSimulation =
    actualTimestepIndex !== undefined &&
    (resolved.status === "success" || resolved.status === "warning")
      ? { ...resolved, currentTimestepIndex: actualTimestepIndex }
      : resolved;

  return { finalSimulation, resultsReader };
}

async function fetchSimulationResults(
  simulation: SimulationState,
  sourceId: string,
  preserveTimestepIndex?: number,
): Promise<{
  resultsReader: ResultsReader;
  actualTimestepIndex?: number;
}> {
  if (
    (simulation.status === "success" || simulation.status === "warning") &&
    simulation.metadata
  ) {
    const [{ OPFSStorage }, { EPSResultsReader }, { getAppId }] =
      await Promise.all([
        import("src/infra/storage"),
        import("src/simulation"),
        import("src/infra/app-instance"),
      ]);

    const appId = getAppId();
    const storage = new OPFSStorage(appId, sourceId);
    const epsReader = new EPSResultsReader(storage);
    await epsReader.initialize(simulation.metadata, simulation.simulationIds);

    let timestepIndex: number;
    if (preserveTimestepIndex !== undefined) {
      timestepIndex = Math.min(
        preserveTimestepIndex,
        epsReader.timestepCount - 1,
      );
    } else {
      timestepIndex = simulation.currentTimestepIndex ?? 0;
    }

    const resultsReader = await epsReader.getResultsForTimestep(timestepIndex);
    return { resultsReader, actualTimestepIndex: timestepIndex };
  }
  return { resultsReader: null };
}
