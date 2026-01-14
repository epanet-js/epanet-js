import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAtom, useAtomValue } from "jotai";

import {
  ChevronDownIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  LockIcon,
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
import { simulationAtom, initialSimulationState } from "src/state/jotai";
import {
  Button,
  DDContent,
  StyledItem,
  StyledTooltipArrow,
  TContent,
} from "../elements";

export const ScenarioSwitcher = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const persistence = usePersistence() as MemPersistence;
  const [scenariosState, setScenariosState] = useAtom(scenariosAtom);
  const scenariosList = useAtomValue(scenariosListAtom);
  const [simulation, setSimulation] = useAtom(simulationAtom);

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

    // Save current scenario's state (momentLog + simulation + modelVersion)
    const currentScenario = scenariosState.scenarios.get(activeScenarioId);
    if (currentScenario) {
      currentScenario.momentLog = persistence.getMomentLog();
      currentScenario.simulation = simulation;
      currentScenario.modelVersion = persistence.getModelVersion();
    }

    // Restore to base state (deletes scenario-added assets)
    if (scenariosState.baseModelSnapshot) {
      persistence.restoreToBase(scenariosState.baseModelSnapshot);
    }

    // Replay main's deltas on top
    if (scenariosState.mainMomentLog) {
      const deltas = scenariosState.mainMomentLog.getDeltas();
      for (const delta of deltas) {
        persistence.applySnapshot(delta, "");
      }
      persistence.switchMomentLog(scenariosState.mainMomentLog);
    }

    // Restore Main's modelVersion (must be after replay to override corrupted version)
    if (scenariosState.mainModelVersion) {
      persistence.setModelVersion(scenariosState.mainModelVersion);
    }

    // Restore Main's simulation state
    setSimulation(scenariosState.mainSimulation ?? initialSimulationState);

    setScenariosState((prev) => ({
      ...prev,
      activeScenarioId: null,
    }));
  };

  const handleSelectScenario = (scenarioId: string) => {
    if (activeScenarioId === scenarioId) return;

    const scenario = scenariosState.scenarios.get(scenarioId);
    userTracking.capture({
      name: "scenario.switched",
      scenarioId,
      scenarioName: scenario?.name,
    });

    // Save current state (momentLog + simulation + modelVersion)
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

    // Restore to base state (deletes scenario-added assets)
    if (scenariosState.baseModelSnapshot) {
      persistence.restoreToBase(scenariosState.baseModelSnapshot);
    }

    // Replay target scenario's deltas on top
    if (scenario) {
      const deltas = scenario.momentLog.getDeltas();
      for (const delta of deltas) {
        persistence.applySnapshot(delta, "");
      }
      persistence.switchMomentLog(scenario.momentLog);

      // Restore scenario's modelVersion (must be after replay to override corrupted version)
      persistence.setModelVersion(scenario.modelVersion);
    }

    // Restore target scenario's simulation state
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

    // Save current state (momentLog + simulation + modelVersion)
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

    // Restore to base state (deletes scenario-added assets) before switching to new scenario
    persistence.restoreToBase(baseSnapshot);
    persistence.switchMomentLog(newMomentLog);

    // Set model version to base snapshot (new scenario starts at base state)
    persistence.setModelVersion(baseSnapshot.stateId);

    // New scenario starts with no simulation results
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
              <GitBranchIcon size="sm" />
              <span>{translate("scenarios.enableScenarios")}</span>
            </button>
          </Tooltip.Trigger>
          <TContent side="bottom">
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
                    <LockIcon size="sm" />
                  ) : (
                    <GitBranchIcon size="sm" />
                  )}
                  <span className="truncate text-sm">{activeDisplayName}</span>
                </div>
                <ChevronDownIcon size="sm" />
              </Button>
            </DD.Trigger>
          </Tooltip.Trigger>
          <DD.Portal>
            <DDContent align="start" side="bottom" className="min-w-64">
              <StyledItem onSelect={handleSelectMain}>
                <div
                  className={`flex items-center w-full gap-2 ${isMainActive ? "text-purple-600" : ""}`}
                >
                  <LockIcon size="sm" />
                  <div className="flex-1">{translate("scenarios.main")}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateScenario();
                    }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded"
                  >
                    <GitBranchPlusIcon size="sm" />
                    {translate("scenarios.newScenario")}
                  </button>
                </div>
              </StyledItem>

              {scenariosList.map((scenario, index) => (
                <StyledItem
                  key={scenario.id}
                  onSelect={() => handleSelectScenario(scenario.id)}
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
                  </div>
                </StyledItem>
              ))}
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
      <TContent side="bottom">
        <StyledTooltipArrow />
        {translate("scenarios.switcherTooltip")}
      </TContent>
    </Tooltip.Root>
  );
};
