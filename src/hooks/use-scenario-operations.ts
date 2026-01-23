import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { usePersistence } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { scenariosAtom } from "src/state/scenarios";
import { initialSimulationState, simulationAtom } from "src/state/jotai";
import { modeAtom, Mode } from "src/state/mode";
import {
  createScenario,
  switchToScenario as switchToScenarioFn,
  switchToMain as switchToMainFn,
  deleteScenario,
  renameScenario,
  getSimulationForState,
  type ScenarioContext,
} from "src/lib/scenarios";

const DRAWING_MODES: Mode[] = [
  Mode.DRAW_JUNCTION,
  Mode.DRAW_PIPE,
  Mode.DRAW_RESERVOIR,
  Mode.DRAW_PUMP,
  Mode.DRAW_VALVE,
  Mode.DRAW_TANK,
  Mode.CONNECT_CUSTOMER_POINTS,
  Mode.REDRAW_LINK,
];

export const useScenarioOperations = () => {
  const persistence = usePersistence() as MemPersistence;
  const [scenariosState, setScenariosState] = useAtom(scenariosAtom);
  const setSimulation = useSetAtom(simulationAtom);
  const setMode = useSetAtom(modeAtom);

  const getContext = useCallback(
    (): ScenarioContext => ({
      currentMomentLog: persistence.getMomentLog(),
      currentModelVersion: persistence.getModelVersion(),
      currentSimulation: persistence.getSimulation(),
    }),
    [persistence],
  );

  const switchToMain = useCallback(() => {
    const result = switchToMainFn(scenariosState, getContext());

    if (result.applyTarget) {
      persistence.applyScenarioTarget(result.applyTarget);
    }

    setScenariosState(result.state);
    setSimulation(getSimulationForState(result.state, initialSimulationState));

    setMode((modeState) => {
      if (DRAWING_MODES.includes(modeState.mode)) {
        return { mode: Mode.NONE };
      }
      return modeState;
    });
  }, [
    persistence,
    scenariosState,
    getContext,
    setScenariosState,
    setSimulation,
    setMode,
  ]);

  const switchToScenario = useCallback(
    (scenarioId: string) => {
      const result = switchToScenarioFn(
        scenariosState,
        scenarioId,
        getContext(),
      );

      if (result.applyTarget) {
        persistence.applyScenarioTarget(result.applyTarget);
      }

      setScenariosState(result.state);
      setSimulation(
        getSimulationForState(result.state, initialSimulationState),
      );
    },
    [persistence, scenariosState, getContext, setScenariosState, setSimulation],
  );

  const createNewScenario = useCallback(() => {
    const baseSnapshot =
      scenariosState.baseModelSnapshot ?? persistence.captureModelSnapshot();

    const result = createScenario(scenariosState, getContext(), baseSnapshot);

    persistence.applyScenarioTarget(result.applyTarget);
    setScenariosState(result.state);
    setSimulation(initialSimulationState);

    return { scenarioId: result.scenarioId, scenarioName: result.scenarioName };
  }, [
    persistence,
    scenariosState,
    getContext,
    setScenariosState,
    setSimulation,
  ]);

  const deleteScenarioById = useCallback(
    (scenarioId: string) => {
      const result = deleteScenario(scenariosState, scenarioId);

      if (result.applyTarget) {
        persistence.applyScenarioTarget(result.applyTarget);
      }

      setScenariosState(result.state);
      setSimulation(
        getSimulationForState(result.state, initialSimulationState),
      );
    },
    [persistence, scenariosState, setScenariosState, setSimulation],
  );

  const renameScenarioById = useCallback(
    (scenarioId: string, newName: string) => {
      setScenariosState(renameScenario(scenariosState, scenarioId, newName));
    },
    [scenariosState, setScenariosState],
  );

  return {
    switchToMain,
    switchToScenario,
    createNewScenario,
    deleteScenarioById,
    renameScenarioById,
  };
};
