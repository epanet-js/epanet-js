import type {
  BaseModelSnapshot,
  Scenario,
  ScenariosState,
} from "src/state/scenarios";
import type { ScenarioContext, CreateScenarioResult } from "./types";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";

export const createScenario = (
  currentState: ScenariosState,
  context: ScenarioContext,
  baseSnapshot: BaseModelSnapshot,
): CreateScenarioResult => {
  const isMainActive = currentState.activeScenarioId === null;

  const mainMomentLog = isMainActive
    ? context.currentMomentLog
    : currentState.mainMomentLog;
  const mainSimulation = isMainActive
    ? context.currentSimulation
    : currentState.mainSimulation;
  const mainModelVersion = isMainActive
    ? context.currentModelVersion
    : currentState.mainModelVersion;

  const updatedScenarios = new Map(currentState.scenarios);

  if (!isMainActive && currentState.activeScenarioId) {
    const currentScenario = currentState.scenarios.get(
      currentState.activeScenarioId,
    );
    if (currentScenario) {
      updatedScenarios.set(currentState.activeScenarioId, {
        ...currentScenario,
        momentLog: context.currentMomentLog,
        simulation: context.currentSimulation,
        modelVersion: context.currentModelVersion,
      });
    }
  }

  const newNumber = currentState.highestScenarioNumber + 1;
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
      ...currentState,
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
