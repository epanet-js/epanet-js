import type {
  BaseModelSnapshot,
  Scenario,
  ScenariosState,
} from "src/state/scenarios";
import type { ScenarioContext, CreateScenarioResult } from "./types";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";

export const createScenario = (
  scenariosState: ScenariosState,
  context: ScenarioContext,
  baseSnapshot: BaseModelSnapshot,
): CreateScenarioResult => {
  const isMainActive = scenariosState.activeScenarioId === null;

  const mainMomentLog = isMainActive
    ? context.currentMomentLog
    : scenariosState.mainMomentLog;
  const mainSimulation = isMainActive
    ? context.currentSimulation
    : scenariosState.mainSimulation;
  const mainModelVersion = isMainActive
    ? context.currentModelVersion
    : scenariosState.mainModelVersion;

  const updatedScenarios = new Map(scenariosState.scenarios);

  if (!isMainActive && scenariosState.activeScenarioId) {
    const currentScenario = scenariosState.scenarios.get(
      scenariosState.activeScenarioId,
    );
    if (currentScenario) {
      updatedScenarios.set(scenariosState.activeScenarioId, {
        ...currentScenario,
        momentLog: context.currentMomentLog,
        simulation: context.currentSimulation,
        modelVersion: context.currentModelVersion,
      });
    }
  }

  const newNumber = scenariosState.highestScenarioNumber + 1;
  const newMomentLog = new MomentLog();
  newMomentLog.setSnapshot(baseSnapshot.moment, baseSnapshot.stateId);

  const newScenario: Scenario = {
    id: nanoid(),
    name: `Scenario #${newNumber}`,
    number: newNumber,
    createdAt: Date.now(),
    momentLog: newMomentLog,
    simulation: null,
    modelVersion: baseSnapshot.stateId,
  };

  updatedScenarios.set(newScenario.id, newScenario);

  return {
    scenarioId: newScenario.id,
    scenarioName: newScenario.name,
    simulation: null,
    state: {
      ...scenariosState,
      scenarios: updatedScenarios,
      highestScenarioNumber: newNumber,
      activeScenarioId: newScenario.id,
      baseModelSnapshot: baseSnapshot,
      mainMomentLog,
      mainSimulation,
      mainModelVersion,
    },
    applyTarget: {
      baseSnapshot,
      momentLog: newMomentLog,
      modelVersion: baseSnapshot.stateId,
    },
  };
};
