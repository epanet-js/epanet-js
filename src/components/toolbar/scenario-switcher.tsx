import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAtom, useAtomValue } from "jotai";

import { AddIcon, CheckIcon, ChevronDownIcon } from "src/icons";
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
  Button,
  DDContent,
  DDSeparator,
  StyledItem,
  StyledTooltipArrow,
  TContent,
} from "../elements";

// Debug helper to get momentLog stats
const getMomentLogStats = (momentLog: MomentLog | null | undefined) => {
  if (!momentLog) return { deltas: 0, puts: 0, deletes: 0 };
  const deltas = momentLog.getDeltas();
  let puts = 0;
  let deletes = 0;
  for (const delta of deltas) {
    puts += delta.putAssets?.length || 0;
    deletes += delta.deleteAssets?.length || 0;
  }
  return { deltas: deltas.length, puts, deletes };
};

export const ScenarioSwitcher = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const persistence = usePersistence() as MemPersistence;
  const [scenariosState, setScenariosState] = useAtom(scenariosAtom);
  const scenariosList = useAtomValue(scenariosListAtom);

  const activeScenarioId = scenariosState.activeScenarioId;
  const isMainActive = activeScenarioId === null;

  // Debug: get current stats
  const currentMomentLog = persistence.getMomentLog();
  const currentStats = getMomentLogStats(currentMomentLog);
  const mainStats = getMomentLogStats(scenariosState.mainMomentLog);
  const baseAssets = scenariosState.baseModelSnapshot?.moment.putAssets?.length || 0;

  const activeDisplayName = isMainActive
    ? translate("scenarios.main")
    : (scenariosState.scenarios.get(activeScenarioId)?.name ??
      translate("scenarios.main"));

  const handleSelectMain = () => {
    if (isMainActive) return;

    console.log("DEBUG === handleSelectMain START ===");

    userTracking.capture({
      name: "scenario.switched",
      scenarioId: null,
      scenarioName: "Main",
    });

    const currentScenario = scenariosState.scenarios.get(activeScenarioId);
    if (currentScenario) {
      currentScenario.momentLog = persistence.getMomentLog();
      console.log("DEBUG [handleSelectMain] Saved current scenario momentLog, deltas:", currentScenario.momentLog.getDeltas().length);
    }

    // Restore to base state (deletes scenario-added assets)
    if (scenariosState.baseModelSnapshot) {
      console.log("DEBUG [handleSelectMain] Restoring to base...");
      persistence.restoreToBase(scenariosState.baseModelSnapshot);
    }

    // Replay main's deltas on top
    if (scenariosState.mainMomentLog) {
      const deltas = scenariosState.mainMomentLog.getDeltas();
      console.log("DEBUG [handleSelectMain] Replaying main deltas:", deltas.length);
      for (const delta of deltas) {
        persistence.applySnapshot(delta, "");
      }
      persistence.switchMomentLog(scenariosState.mainMomentLog);
    }
    console.log("DEBUG === handleSelectMain END ===");

    setScenariosState((prev) => ({
      ...prev,
      activeScenarioId: null,
    }));
  };

  const handleSelectScenario = (scenarioId: string) => {
    if (activeScenarioId === scenarioId) return;

    console.log("DEBUG === handleSelectScenario START ===", scenarioId);

    const scenario = scenariosState.scenarios.get(scenarioId);
    userTracking.capture({
      name: "scenario.switched",
      scenarioId,
      scenarioName: scenario?.name,
    });

    if (isMainActive) {
      console.log("DEBUG [handleSelectScenario] Saving main momentLog");
      setScenariosState((prev) => ({
        ...prev,
        mainMomentLog: persistence.getMomentLog(),
      }));
    } else {
      const currentScenario = scenariosState.scenarios.get(activeScenarioId);
      if (currentScenario) {
        currentScenario.momentLog = persistence.getMomentLog();
        console.log("DEBUG [handleSelectScenario] Saved current scenario momentLog, deltas:", currentScenario.momentLog.getDeltas().length);
      }
    }

    // Restore to base state (deletes scenario-added assets)
    if (scenariosState.baseModelSnapshot) {
      console.log("DEBUG [handleSelectScenario] Restoring to base...");
      persistence.restoreToBase(scenariosState.baseModelSnapshot);
    }

    // Replay target scenario's deltas on top
    if (scenario) {
      const deltas = scenario.momentLog.getDeltas();
      console.log("DEBUG [handleSelectScenario] Replaying scenario deltas:", deltas.length);
      for (const delta of deltas) {
        persistence.applySnapshot(delta, "");
      }
      persistence.switchMomentLog(scenario.momentLog);
    }
    console.log("DEBUG === handleSelectScenario END ===");

    setScenariosState((prev) => ({
      ...prev,
      activeScenarioId: scenarioId,
    }));
  };

  const handleCreateScenario = () => {
    console.log("DEBUG === handleCreateScenario START ===");

    let baseSnapshot = scenariosState.baseModelSnapshot;
    if (!baseSnapshot) {
      console.log("DEBUG [handleCreateScenario] Capturing new base snapshot");
      baseSnapshot = persistence.captureModelSnapshot();
    }
    console.log("DEBUG [handleCreateScenario] baseSnapshot assets:", baseSnapshot.moment.putAssets?.length || 0);

    const mainMomentLog = isMainActive
      ? persistence.getMomentLog()
      : scenariosState.mainMomentLog;

    if (!isMainActive) {
      const currentScenario = scenariosState.scenarios.get(activeScenarioId);
      if (currentScenario) {
        currentScenario.momentLog = persistence.getMomentLog();
        console.log("DEBUG [handleCreateScenario] Saved current scenario momentLog, deltas:", currentScenario.momentLog.getDeltas().length);
      }
    }

    const newMomentLog = new MomentLog();
    newMomentLog.setSnapshot(baseSnapshot.moment, baseSnapshot.stateId);

    const newScenario = createScenario(scenariosState, newMomentLog);

    userTracking.capture({
      name: "scenario.created",
      scenarioId: newScenario.id,
      scenarioName: newScenario.name,
    });

    // Restore to base state (deletes scenario-added assets) before switching to new scenario
    console.log("DEBUG [handleCreateScenario] Restoring to base...");
    persistence.restoreToBase(baseSnapshot);
    persistence.switchMomentLog(newMomentLog);
    console.log("DEBUG === handleCreateScenario END ===");

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
      };
    });
  };

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 group bn flex items-stretch py-1 focus:outline-none">
        <DD.Root
          onOpenChange={(open) => {
            if (open) {
              userTracking.capture({ name: "scenarioSwitcher.opened" });
            }
          }}
        >
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild>
              <Button variant="quiet">
                <span className="max-w-24 truncate text-sm">
                  {activeDisplayName}
                </span>
                <ChevronDownIcon size="sm" />
              </Button>
            </DD.Trigger>
          </Tooltip.Trigger>
          <DD.Portal>
            <DDContent align="start" side="bottom" className="min-w-64">
              {/* Debug info */}
              <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-200">
                <div>Current: {currentStats.deltas}d, +{currentStats.puts}, -{currentStats.deletes}</div>
                <div>Base assets: {baseAssets}</div>
              </div>

              <StyledItem onSelect={handleSelectMain}>
                <div className="flex items-center w-full gap-2">
                  <div className="flex-1">
                    <div>{translate("scenarios.main")}</div>
                    <div className="text-xs text-gray-400">
                      {mainStats.deltas}d, +{mainStats.puts}, -{mainStats.deletes}
                    </div>
                  </div>
                  <div className="w-4 h-4 flex items-center justify-center">
                    {isMainActive && <CheckIcon className="text-purple-700" />}
                  </div>
                </div>
              </StyledItem>

              {scenariosList.map((scenario) => {
                const stats = getMomentLogStats(scenario.momentLog);
                return (
                  <StyledItem
                    key={scenario.id}
                    onSelect={() => handleSelectScenario(scenario.id)}
                  >
                    <div className="flex items-center w-full gap-2">
                      <div className="flex-1">
                        <div>{scenario.name}</div>
                        <div className="text-xs text-gray-400">
                          {stats.deltas}d, +{stats.puts}, -{stats.deletes}
                        </div>
                      </div>
                      <div className="w-4 h-4 flex items-center justify-center">
                        {activeScenarioId === scenario.id && (
                          <CheckIcon className="text-purple-700" />
                        )}
                      </div>
                    </div>
                  </StyledItem>
                );
              })}

              <DDSeparator />

              <StyledItem onSelect={handleCreateScenario}>
                <AddIcon size="sm" />
                {translate("scenarios.createNew")}
              </StyledItem>
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
