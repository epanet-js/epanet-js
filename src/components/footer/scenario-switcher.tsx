import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAtom, useAtomValue, useSetAtom } from "jotai";

import {
  ChevronDownIcon,
  ScenarioIcon,
  AddScenarioIcon,
  MainModelIcon,
  MoreActionsIcon,
  DeleteIcon,
} from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { MomentLog } from "src/lib/persistence/moment-log";
import {
  scenariosAtom,
  scenariosListAtom,
  createScenario,
} from "src/state/scenarios";
import {
  simulationAtom,
  initialSimulationState,
  dialogAtom,
} from "src/state/jotai";
import {
  Button,
  DDContent,
  DDSeparator,
  StyledItem,
  StyledTooltipArrow,
  TContent,
} from "../elements";
import { modeAtom, Mode } from "src/state/mode";

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

export const ScenarioSwitcher = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const persistence = usePersistence() as MemPersistence;
  const [scenariosState, setScenariosState] = useAtom(scenariosAtom);
  const scenariosList = useAtomValue(scenariosListAtom);
  const [simulation, setSimulation] = useAtom(simulationAtom);
  const [modeState, setMode] = useAtom(modeAtom);
  const setDialog = useSetAtom(dialogAtom);

  const activeScenarioId = scenariosState.activeScenarioId;
  const isMainActive = activeScenarioId === null;

  const activeDisplayName = isMainActive
    ? translate("scenarios.main")
    : (scenariosState.scenarios.get(activeScenarioId)?.name ??
      translate("scenarios.main"));

  const handleSelectMain = () => {
    if (isMainActive) return;

    userTracking.capture({
      name: "scenario.switched",
      scenarioId: null,
      scenarioName: "Main",
    });

    const currentScenario = scenariosState.scenarios.get(activeScenarioId);
    if (currentScenario) {
      currentScenario.momentLog = persistence.getMomentLog();
      currentScenario.simulation = simulation;
      currentScenario.modelVersion = persistence.getModelVersion();
    }

    if (scenariosState.baseModelSnapshot) {
      persistence.restoreToBase(scenariosState.baseModelSnapshot);
    }

    if (scenariosState.mainMomentLog) {
      const deltas = scenariosState.mainMomentLog.getDeltas();
      for (const delta of deltas) {
        persistence.applySnapshot(delta, "");
      }
      persistence.switchMomentLog(scenariosState.mainMomentLog);
    }

    if (scenariosState.mainModelVersion) {
      persistence.setModelVersion(scenariosState.mainModelVersion);
    }

    setSimulation(scenariosState.mainSimulation ?? initialSimulationState);

    setScenariosState((prev) => ({
      ...prev,
      activeScenarioId: null,
    }));

    if (DRAWING_MODES.includes(modeState.mode)) {
      setMode({ mode: Mode.NONE });
    }
  };

  const handleSelectScenario = (scenarioId: string) => {
    if (activeScenarioId === scenarioId) return;

    const scenario = scenariosState.scenarios.get(scenarioId);
    userTracking.capture({
      name: "scenario.switched",
      scenarioId,
      scenarioName: scenario?.name,
    });

    if (isMainActive) {
      setScenariosState((prev) => ({
        ...prev,
        mainMomentLog: persistence.getMomentLog(),
        mainSimulation: simulation,
        mainModelVersion: persistence.getModelVersion(),
      }));
    } else {
      const currentScenario = scenariosState.scenarios.get(activeScenarioId);
      if (currentScenario) {
        currentScenario.momentLog = persistence.getMomentLog();
        currentScenario.simulation = simulation;
        currentScenario.modelVersion = persistence.getModelVersion();
      }
    }

    if (scenariosState.baseModelSnapshot) {
      persistence.restoreToBase(scenariosState.baseModelSnapshot);
    }

    if (scenario) {
      const deltas = scenario.momentLog.getDeltas();
      for (const delta of deltas) {
        persistence.applySnapshot(delta, "");
      }
      persistence.switchMomentLog(scenario.momentLog);

      persistence.setModelVersion(scenario.modelVersion);
    }

    setSimulation(scenario?.simulation ?? initialSimulationState);

    setScenariosState((prev) => ({
      ...prev,
      activeScenarioId: scenarioId,
    }));
  };

  const handleCreateScenario = () => {
    let baseSnapshot = scenariosState.baseModelSnapshot;
    if (!baseSnapshot) {
      baseSnapshot = persistence.captureModelSnapshot();
    }

    const mainMomentLog = isMainActive
      ? persistence.getMomentLog()
      : scenariosState.mainMomentLog;

    const mainSimulation = isMainActive
      ? simulation
      : scenariosState.mainSimulation;

    const mainModelVersion = isMainActive
      ? persistence.getModelVersion()
      : scenariosState.mainModelVersion;

    if (!isMainActive) {
      const currentScenario = scenariosState.scenarios.get(activeScenarioId);
      if (currentScenario) {
        currentScenario.momentLog = persistence.getMomentLog();
        currentScenario.simulation = simulation;
        currentScenario.modelVersion = persistence.getModelVersion();
      }
    }

    const newMomentLog = new MomentLog();
    newMomentLog.setSnapshot(baseSnapshot.moment, baseSnapshot.stateId);

    const newScenario = createScenario(
      scenariosState,
      newMomentLog,
      baseSnapshot.stateId,
    );

    userTracking.capture({
      name: "scenario.created",
      scenarioId: newScenario.id,
      scenarioName: newScenario.name,
    });

    persistence.restoreToBase(baseSnapshot);
    persistence.switchMomentLog(newMomentLog);

    persistence.setModelVersion(baseSnapshot.stateId);

    setSimulation(initialSimulationState);

    setScenariosState((prev) => {
      const newScenarios = new Map(prev.scenarios);
      newScenarios.set(newScenario.id, newScenario);
      return {
        ...prev,
        scenarios: newScenarios,
        highestScenarioNumber: newScenario.number,
        activeScenarioId: newScenario.id,
        baseModelSnapshot: baseSnapshot,
        mainMomentLog: mainMomentLog,
        mainSimulation: mainSimulation,
        mainModelVersion: mainModelVersion,
      };
    });
  };

  const handleDeleteScenario = (scenarioId: string) => {
    const scenarioToDelete = scenariosState.scenarios.get(scenarioId);
    if (!scenarioToDelete) return;

    const remainingScenarios = scenariosList.filter((s) => s.id !== scenarioId);
    const isDeletedActive = activeScenarioId === scenarioId;

    if (remainingScenarios.length === 0) {
      // Last scenario being deleted - reset to initial state
      if (scenariosState.baseModelSnapshot) {
        persistence.restoreToBase(scenariosState.baseModelSnapshot);
      }

      if (scenariosState.mainMomentLog) {
        const deltas = scenariosState.mainMomentLog.getDeltas();
        for (const delta of deltas) {
          persistence.applySnapshot(delta, "");
        }
        persistence.switchMomentLog(scenariosState.mainMomentLog);
      }

      if (scenariosState.mainModelVersion) {
        persistence.setModelVersion(scenariosState.mainModelVersion);
      }

      setSimulation(scenariosState.mainSimulation ?? initialSimulationState);

      setScenariosState((prev) => ({
        ...prev,
        scenarios: new Map(),
        activeScenarioId: null,
        baseModelSnapshot: null,
        mainMomentLog: null,
        mainSimulation: null,
        mainModelVersion: null,
        highestScenarioNumber: 0,
      }));
    } else if (isDeletedActive) {
      // Deleted scenario was active - switch to first remaining scenario
      const nextScenario = remainingScenarios[0];

      if (scenariosState.baseModelSnapshot) {
        persistence.restoreToBase(scenariosState.baseModelSnapshot);
      }

      const deltas = nextScenario.momentLog.getDeltas();
      for (const delta of deltas) {
        persistence.applySnapshot(delta, "");
      }
      persistence.switchMomentLog(nextScenario.momentLog);
      persistence.setModelVersion(nextScenario.modelVersion);

      setSimulation(nextScenario.simulation ?? initialSimulationState);

      setScenariosState((prev) => {
        const newScenarios = new Map(prev.scenarios);
        newScenarios.delete(scenarioId);
        return {
          ...prev,
          scenarios: newScenarios,
          activeScenarioId: nextScenario.id,
        };
      });
    } else {
      // Deleted scenario was not active - just remove from list
      setScenariosState((prev) => {
        const newScenarios = new Map(prev.scenarios);
        newScenarios.delete(scenarioId);
        return {
          ...prev,
          scenarios: newScenarios,
        };
      });
    }
  };

  const openDeleteConfirmation = (scenarioId: string, scenarioName: string) => {
    setDialog({
      type: "deleteScenarioConfirmation",
      scenarioId,
      scenarioName,
      onConfirm: handleDeleteScenario,
    });
  };

  const hasScenarios = scenariosList.length > 0;

  if (!hasScenarios) {
    return (
      <div className="w-44 flex items-center">
        <Tooltip.Root delayDuration={200}>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleCreateScenario}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
            >
              <ScenarioIcon size="sm" />
              <span>{translate("scenarios.enableScenarios")}</span>
            </button>
          </Tooltip.Trigger>
          <TContent side="top">
            <StyledTooltipArrow />
            {translate("scenarios.enableScenarios")}
          </TContent>
        </Tooltip.Root>
      </div>
    );
  }

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="w-44 h-10 group bn flex items-stretch py-1 focus:outline-none">
        <DD.Root
          onOpenChange={(open) => {
            if (open) {
              userTracking.capture({ name: "scenarioSwitcher.opened" });
            }
          }}
        >
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild>
              <Button variant="quiet" className="w-full justify-between">
                <div className="flex items-center gap-1">
                  {isMainActive ? (
                    <MainModelIcon size="sm" />
                  ) : (
                    <ScenarioIcon size="sm" />
                  )}
                  <span className="truncate text-sm">{activeDisplayName}</span>
                </div>
                <ChevronDownIcon size="sm" />
              </Button>
            </DD.Trigger>
          </Tooltip.Trigger>
          <DD.Portal>
            <DDContent align="start" side="top" className="min-w-64">
              <StyledItem onSelect={handleSelectMain}>
                <div
                  className={`flex items-center w-full gap-2 ${isMainActive ? "text-purple-600" : ""}`}
                >
                  <MainModelIcon size="sm" />
                  <div className="flex-1">{translate("scenarios.main")}</div>
                </div>
              </StyledItem>

              {scenariosList.map((scenario, index) => (
                <StyledItem
                  key={scenario.id}
                  onSelect={() => handleSelectScenario(scenario.id)}
                  className="group/scenario"
                >
                  <div
                    className={`flex items-center w-full gap-2 ${activeScenarioId === scenario.id ? "text-purple-600" : ""}`}
                  >
                    <span
                      className={`font-mono text-sm pl-1 ${activeScenarioId === scenario.id ? "text-purple-400" : "text-gray-400"}`}
                    >
                      {index === scenariosList.length - 1 ? "└──" : "├──"}
                    </span>
                    <div className="flex-1">{scenario.name}</div>
                    <DD.Root>
                      <DD.Trigger asChild>
                        <button
                          className="opacity-0 group-hover/scenario:opacity-100 data-[state=open]:opacity-100 p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-500 dark:text-gray-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreActionsIcon size="sm" />
                        </button>
                      </DD.Trigger>
                      <DD.Portal>
                        <DDContent side="right" align="start" sideOffset={4}>
                          <StyledItem
                            onSelect={() =>
                              openDeleteConfirmation(scenario.id, scenario.name)
                            }
                            className="text-red-500 dark:text-red-300"
                          >
                            <DeleteIcon size="sm" />
                            <span>{translate("scenarios.delete")}</span>
                          </StyledItem>
                        </DDContent>
                      </DD.Portal>
                    </DD.Root>
                  </div>
                </StyledItem>
              ))}

              <DDSeparator />

              <StyledItem onSelect={handleCreateScenario}>
                <div className="flex items-center gap-2">
                  <AddScenarioIcon size="sm" />
                  <span>{translate("scenarios.createNew")}</span>
                </div>
              </StyledItem>
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
      <TContent side="top">
        <StyledTooltipArrow />
        {translate("scenarios.switcherTooltip")}
      </TContent>
    </Tooltip.Root>
  );
};
