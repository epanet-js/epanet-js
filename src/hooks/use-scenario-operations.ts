import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { usePersistence } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import {
  scenariosAtom,
  createScenario as createScenarioObject,
} from "src/state/scenarios";
import { simulationAtom, initialSimulationState } from "src/state/jotai";
import { modeAtom, Mode } from "src/state/mode";
import { MomentLog } from "src/lib/persistence/moment-log";

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
  const [simulation, setSimulation] = useAtom(simulationAtom);
  const setMode = useSetAtom(modeAtom);

  const switchToMain = useCallback(() => {
    const newState = persistence.switchToMainScenario(
      scenariosState,
      () => simulation,
    );
    setScenariosState(newState);

    const newSimulation = persistence.getSimulationForState(
      newState,
      initialSimulationState,
    );
    setSimulation(newSimulation);

    setMode((modeState) => {
      if (DRAWING_MODES.includes(modeState.mode)) {
        return { mode: Mode.NONE };
      }
      return modeState;
    });
  }, [persistence, scenariosState, simulation, setScenariosState, setSimulation, setMode]);

  const switchToScenario = useCallback(
    (scenarioId: string) => {
      const newState = persistence.switchToScenario(
        scenariosState,
        scenarioId,
        () => simulation,
      );
      setScenariosState(newState);

      const newSimulation = persistence.getSimulationForState(
        newState,
        initialSimulationState,
      );
      setSimulation(newSimulation);
    },
    [persistence, scenariosState, simulation, setScenariosState, setSimulation],
  );

  const createNewScenario = useCallback(() => {
    const { state: newState, scenarioId, scenarioName } = persistence.createScenario(
      scenariosState,
      (state) => {
        const newMomentLog = new MomentLog();
        return createScenarioObject(
          state,
          newMomentLog,
          state.baseModelSnapshot!.stateId,
        );
      },
      () => simulation,
    );

    setScenariosState(newState);
    setSimulation(initialSimulationState);

    return { scenarioId, scenarioName };
  }, [persistence, scenariosState, simulation, setScenariosState, setSimulation]);

  const deleteScenarioById = useCallback(
    (scenarioId: string) => {
      const newState = persistence.deleteScenario(
        scenariosState,
        scenarioId,
        () => simulation,
      );
      setScenariosState(newState);

      const newSimulation = persistence.getSimulationForState(
        newState,
        initialSimulationState,
      );
      setSimulation(newSimulation);
    },
    [persistence, scenariosState, simulation, setScenariosState, setSimulation],
  );

  return {
    switchToMain,
    switchToScenario,
    createNewScenario,
    deleteScenarioById,
  };
};
