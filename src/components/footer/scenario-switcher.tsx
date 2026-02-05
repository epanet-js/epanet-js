import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAtomValue, useSetAtom } from "jotai";

import {
  ChevronDownIcon,
  ScenarioIcon,
  AddScenarioIcon,
  MainModelIcon,
  MoreActionsIcon,
  DeleteIcon,
  RenameIcon,
} from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { worktreeAtom, scenariosListAtom } from "src/state/scenarios";
import { dialogAtom } from "src/state/jotai";
import { useCreateScenario } from "src/commands/create-scenario";
import { isMainBranch, getActiveBranch, getMainBranch } from "src/lib/worktree";
import type { Branch, Worktree } from "src/lib/worktree";
import {
  Button,
  DDContent,
  DDSeparator,
  StyledItem,
  StyledTooltipArrow,
  TContent,
} from "../elements";

const VersionDebugInfo = ({
  branch,
  worktree,
}: {
  branch: Branch;
  worktree: Worktree;
}) => {
  const headVersion = worktree.versions.get(branch.headRevisionId);
  const draftVersion = branch.draftVersionId
    ? worktree.versions.get(branch.draftVersionId)
    : null;

  return (
    <div className="text-xs text-gray-400 pl-6 font-mono space-y-0.5">
      {draftVersion ? (
        <div className="flex items-center gap-1">
          <span className="text-yellow-500">✎</span>
          <span>draft: {branch.draftVersionId?.slice(0, 8)}</span>
          <span className="text-gray-500">
            ({draftVersion.deltas.length} deltas)
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-green-500">✓</span>
          <span>rev: {branch.headRevisionId.slice(0, 8)}</span>
          {headVersion && (
            <span className="text-gray-500">
              ({headVersion.deltas.length} deltas)
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const ScenarioSwitcher = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const worktree = useAtomValue(worktreeAtom);
  const scenariosList = useAtomValue(scenariosListAtom);
  const setDialog = useSetAtom(dialogAtom);
  const createScenario = useCreateScenario();

  const {
    switchToMain,
    switchToSnapshot,
    deleteScenarioById,
    renameScenarioById,
  } = useScenarioOperations();

  const activeBranchId = worktree.activeBranchId;
  const isMainActive = isMainBranch(activeBranchId);
  const activeBranch = getActiveBranch(worktree);

  const activeDisplayName = isMainActive
    ? translate("scenarios.main")
    : (activeBranch?.name ?? translate("scenarios.main"));

  const handleSelectMain = () => {
    if (isMainActive) return;

    userTracking.capture({
      name: "scenario.switched",
      scenarioId: null,
      scenarioName: "Main",
    });

    switchToMain();
  };

  const handleSelectScenario = (scenarioId: string) => {
    if (activeBranchId === scenarioId) return;

    const scenario = worktree.branches.get(scenarioId);
    userTracking.capture({
      name: "scenario.switched",
      scenarioId,
      scenarioName: scenario?.name,
    });

    switchToSnapshot(scenarioId);
  };

  const handleCreateScenario = () => {
    createScenario({ source: "scenario-switcher" });
  };

  const handleDeleteScenario = (scenarioId: string) => {
    void deleteScenarioById(scenarioId);
  };

  const openDeleteConfirmation = (scenarioId: string, scenarioName: string) => {
    setDialog({
      type: "deleteScenarioConfirmation",
      scenarioId,
      scenarioName,
      onConfirm: handleDeleteScenario,
    });
  };

  const handleRenameScenario = (scenarioId: string, newName: string) => {
    renameScenarioById(scenarioId, newName);
  };

  const openRenameDialog = (scenarioId: string, scenarioName: string) => {
    setDialog({
      type: "renameScenario",
      scenarioId,
      currentName: scenarioName,
      onConfirm: handleRenameScenario,
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
                  className={`flex flex-col w-full ${isMainActive ? "text-purple-600" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <MainModelIcon size="sm" />
                    <div className="flex-1">{translate("scenarios.main")}</div>
                  </div>
                  {(() => {
                    const mainBranch = getMainBranch(worktree);
                    return mainBranch ? (
                      <VersionDebugInfo
                        branch={mainBranch}
                        worktree={worktree}
                      />
                    ) : null;
                  })()}
                </div>
              </StyledItem>

              {scenariosList.map((scenario, index) => (
                <StyledItem
                  key={scenario.id}
                  onSelect={() => handleSelectScenario(scenario.id)}
                  className="group/scenario"
                >
                  <div
                    className={`flex flex-col w-full ${activeBranchId === scenario.id ? "text-purple-600" : ""}`}
                  >
                    <div className="flex items-center w-full gap-2">
                      <span
                        className={`font-mono text-sm pl-1 ${activeBranchId === scenario.id ? "text-purple-400" : "text-gray-400"}`}
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
                                openRenameDialog(scenario.id, scenario.name)
                              }
                            >
                              <RenameIcon size="sm" />
                              <span>{translate("scenarios.rename")}</span>
                            </StyledItem>

                            <StyledItem
                              onSelect={() =>
                                openDeleteConfirmation(
                                  scenario.id,
                                  scenario.name,
                                )
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
                    <VersionDebugInfo branch={scenario} worktree={worktree} />
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
