import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAtom, useAtomValue } from "jotai";

import { AddIcon, CheckIcon, ChevronDownIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
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

export const ScenarioSwitcher = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const [scenariosState, setScenariosState] = useAtom(scenariosAtom);
  const scenariosList = useAtomValue(scenariosListAtom);

  const activeScenarioId = scenariosState.activeScenarioId;
  const isMainActive = activeScenarioId === null;

  const activeDisplayName = isMainActive
    ? translate("scenarios.main")
    : (scenariosState.scenarios.get(activeScenarioId)?.name ??
      translate("scenarios.main"));

  const handleSelectMain = () => {
    userTracking.capture({
      name: "scenario.switched",
      scenarioId: null,
      scenarioName: "Main",
    });
    setScenariosState((prev) => ({
      ...prev,
      activeScenarioId: null,
    }));
  };

  const handleSelectScenario = (scenarioId: string) => {
    const scenario = scenariosState.scenarios.get(scenarioId);
    userTracking.capture({
      name: "scenario.switched",
      scenarioId,
      scenarioName: scenario?.name,
    });
    setScenariosState((prev) => ({
      ...prev,
      activeScenarioId: scenarioId,
    }));
  };

  const handleCreateScenario = () => {
    const newScenario = createScenario(scenariosState);
    userTracking.capture({
      name: "scenario.created",
      scenarioId: newScenario.id,
      scenarioName: newScenario.name,
    });
    setScenariosState((prev) => {
      const newScenarios = new Map(prev.scenarios);
      newScenarios.set(newScenario.id, newScenario);
      return {
        ...prev,
        scenarios: newScenarios,
        highestScenarioNumber: newScenario.number,
        activeScenarioId: newScenario.id,
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
            <DDContent align="start" side="bottom" className="min-w-40">
              <StyledItem onSelect={handleSelectMain}>
                <div className="flex items-center w-full gap-2">
                  <span className="flex-1">{translate("scenarios.main")}</span>
                  <div className="w-4 h-4 flex items-center justify-center">
                    {isMainActive && <CheckIcon className="text-purple-700" />}
                  </div>
                </div>
              </StyledItem>

              {scenariosList.map((scenario) => (
                <StyledItem
                  key={scenario.id}
                  onSelect={() => handleSelectScenario(scenario.id)}
                >
                  <div className="flex items-center w-full gap-2">
                    <span className="flex-1">{scenario.name}</span>
                    <div className="w-4 h-4 flex items-center justify-center">
                      {activeScenarioId === scenario.id && (
                        <CheckIcon className="text-purple-700" />
                      )}
                    </div>
                  </div>
                </StyledItem>
              ))}

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
