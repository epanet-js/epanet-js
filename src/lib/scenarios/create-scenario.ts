import type {
  BaseModelSnapshot,
  Scenario,
  Worktree,
} from "src/state/scenarios";
import type { ScenarioContext, CreateScenarioResult } from "./types";
import { MomentLog } from "src/lib/persistence/moment-log";
import { nanoid } from "nanoid";

export const createScenario = (
  worktree: Worktree,
  context: ScenarioContext,
  baseSnapshot: BaseModelSnapshot,
): CreateScenarioResult => {
  const isMainActive = worktree.activeScenarioId === null;

  const mainMomentLog = isMainActive
    ? context.currentMomentLog
    : worktree.mainMomentLog;
  const mainSimulation = isMainActive
    ? context.currentSimulation
    : worktree.mainSimulation;
  const mainModelVersion = isMainActive
    ? context.currentModelVersion
    : worktree.mainModelVersion;

  const updatedScenarios = new Map(worktree.scenarios);

  if (!isMainActive && worktree.activeScenarioId) {
    const currentScenario = worktree.scenarios.get(worktree.activeScenarioId);
    if (currentScenario) {
      updatedScenarios.set(worktree.activeScenarioId, {
        ...currentScenario,
        momentLog: context.currentMomentLog,
        simulation: context.currentSimulation,
        modelVersion: context.currentModelVersion,
      });
    }
  }

  const newNumber = worktree.highestScenarioNumber + 1;
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
      ...worktree,
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
