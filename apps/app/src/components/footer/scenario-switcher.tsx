import { useEffect, useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Branch } from "@epanet-js/worktree";
import { Tooltip } from "@epanet-js/ui-kit";
import { useAtomValue, useSetAtom } from "jotai";
import { isPlayingAtom } from "src/state/simulation-playback";

import {
  ChevronDownIcon,
  ScenarioIcon,
  AddScenarioIcon,
  MainModelIcon,
  MoreActionsIcon,
  DeleteIcon,
  RenameIcon,
  DuplicateIcon,
  SuccessIcon,
} from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { notify } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { worktreeAtom, scenariosListAtom } from "src/state/scenarios";
import { isDemoNetworkAtom } from "src/state/file-system";
import { dialogAtom } from "src/state/dialog";
import { useCreateScenario } from "src/commands/create-scenario";
import { useSwitchToBranch } from "src/commands/switch-scenario";
import { useFeatureLock } from "src/components/form/paywall";
import { Button, DDContent, DDSeparator, StyledItem } from "../elements";

export const ScenarioSwitcher = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const worktree = useAtomValue(worktreeAtom);
  const scenariosList = useAtomValue(scenariosListAtom);
  const setDialog = useSetAtom(dialogAtom);
  const isDemoNetwork = useAtomValue(isDemoNetworkAtom);
  const createScenario = useCreateScenario();

  const {
    scenariosAvailable,
    switchToMain,
    deleteScenarioById,
    duplicateScenarioById,
    renameScenarioById,
  } = useScenarioOperations();
  const switchToBranch = useSwitchToBranch();
  const renameLock = useFeatureLock("manageScenarios", "rename");
  const deleteLock = useFeatureLock("manageScenarios", "delete");
  const duplicateLock = useFeatureLock("manageScenarios", "duplicate");

  const isPlaying = useAtomValue(isPlayingAtom);

  const activeBranchId = worktree.activeBranchId;
  const isMainActive = activeBranchId === worktree.mainId;

  const activeDisplayName = isMainActive
    ? translate("scenarios.main")
    : (worktree.branches.get(activeBranchId)?.name ??
      translate("scenarios.main"));

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

    switchToBranch(scenarioId);
  };

  const handleCreateScenario = () => {
    createScenario({ source: "scenario-switcher" });
  };

  const handleDeleteScenario = (scenarioId: string) => {
    void deleteScenarioById(scenarioId);
  };

  const openDeleteConfirmation = (scenarioId: string, scenarioName: string) => {
    if (deleteLock.isLocked) return deleteLock.openPaywall();
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
    if (renameLock.isLocked) return renameLock.openPaywall();
    setDialog({
      type: "renameScenario",
      scenarioId,
      currentName: scenarioName,
      onConfirm: handleRenameScenario,
    });
  };

  const handleDuplicateScenario = (scenarioId: string) => {
    if (duplicateLock.isLocked) return duplicateLock.openPaywall();
    const duplicated = duplicateScenarioById(scenarioId);
    if (!duplicated) return;

    userTracking.capture({
      name: "scenario.duplicated",
      sourceScenarioId: scenarioId,
      ...duplicated,
      isDemoNetwork,
      scenariosCount: scenariosList.length + 1,
    });

    notify({
      variant: "success",
      title: translate("scenarios.duplicated"),
      Icon: SuccessIcon,
      duration: 3000,
    });
  };

  if (!scenariosAvailable) return null;

  const hasScenarios = scenariosList.length > 0;

  if (!hasScenarios) {
    return (
      <div className="min-w-44 flex items-center">
        <Tooltip content={translate("scenarios.enableScenarios")} side="top">
          <button
            onClick={handleCreateScenario}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-size-base text-accent-hover bg-accent-tint hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
          >
            <ScenarioIcon size="sm" />
            <span>{translate("scenarios.enableScenarios")}</span>
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="min-w-44 max-w-80 h-10 group bn flex items-stretch py-1 focus:outline-hidden">
      <DD.Root
        onOpenChange={(open) => {
          if (open) {
            userTracking.capture({ name: "scenarioSwitcher.opened" });
          }
        }}
      >
        <Tooltip content={translate("scenarios.switcherTooltip")} side="top">
          <DD.Trigger asChild disabled={isPlaying}>
            <Button
              variant="quiet"
              className="w-full justify-between"
              disabled={isPlaying}
            >
              <div className="flex items-center gap-1 min-w-0">
                {isMainActive ? (
                  <MainModelIcon size="sm" />
                ) : (
                  <ScenarioIcon size="sm" />
                )}
                <span
                  className="truncate text-size-base"
                  title={activeDisplayName}
                >
                  {activeDisplayName}
                </span>
              </div>
              <ChevronDownIcon size="sm" />
            </Button>
          </DD.Trigger>
        </Tooltip>
        <DD.Portal>
          <DDContent align="start" side="top" className="min-w-64 max-w-80">
            <StyledItem
              onSelect={handleSelectMain}
              className={isMainActive ? "bg-accent-tint!" : undefined}
            >
              <div className="flex items-center w-full gap-2">
                <MainModelIcon size="sm" />
                <div className="flex-1">{translate("scenarios.main")}</div>
              </div>
            </StyledItem>

            <ScenarioList
              scenarios={scenariosList}
              activeBranchId={activeBranchId}
              onSelect={handleSelectScenario}
              onRename={openRenameDialog}
              onDuplicate={handleDuplicateScenario}
              onDelete={openDeleteConfirmation}
            />

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
  );
};

const ROW_HEIGHT = 32;
const LIST_MAX_HEIGHT = "30dvh";

type ScenarioActions = {
  onSelect: (scenarioId: string) => void;
  onRename: (scenarioId: string, scenarioName: string) => void;
  onDuplicate: (scenarioId: string) => void;
  onDelete: (scenarioId: string, scenarioName: string) => void;
};

const ScenarioList = ({
  scenarios,
  activeBranchId,
  ...actions
}: {
  scenarios: Branch[];
  activeBranchId: string;
} & ScenarioActions) => {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

  const virtualizer = useVirtualizer({
    count: scenarios.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const longestName = scenarios.reduce(
    (longest, scenario) =>
      scenario.name.length > longest.length ? scenario.name : longest,
    "",
  );

  const activeIndex = scenarios.findIndex(
    (scenario) => scenario.id === activeBranchId,
  );

  useEffect(
    function showActiveScenario() {
      if (!scrollElement || activeIndex < 0) return;
      virtualizer.scrollToIndex(activeIndex, { align: "center" });
    },
    [scrollElement, activeIndex, virtualizer],
  );

  return (
    <div
      ref={setScrollElement}
      className="overflow-y-auto"
      style={{ maxHeight: LIST_MAX_HEIGHT }}
    >
      <div
        aria-hidden="true"
        className="invisible h-0 overflow-hidden flex gap-2 pl-3 pr-10 text-size-base whitespace-nowrap"
      >
        <span className="font-mono pl-1">├──</span>
        <span>{longestName}</span>
      </div>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const scenario = scenarios[virtualRow.index];
          return (
            <div
              key={scenario.id}
              className="absolute left-0 right-0"
              style={{
                height: ROW_HEIGHT,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ScenarioRow
                scenario={scenario}
                isActive={scenario.id === activeBranchId}
                isLast={virtualRow.index === scenarios.length - 1}
                {...actions}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ScenarioRow = ({
  scenario,
  isActive,
  isLast,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
}: {
  scenario: Branch;
  isActive: boolean;
  isLast: boolean;
} & ScenarioActions) => {
  const translate = useTranslate();

  return (
    <div className="relative group/scenario">
      <StyledItem
        onSelect={() => onSelect(scenario.id)}
        className={`pr-10 ${isActive ? "bg-accent-tint!" : "group-hover/scenario:bg-base-hover"}`}
      >
        <div className="flex items-center w-full min-w-0 gap-2">
          <span
            aria-hidden="true"
            className={`font-mono text-size-base pl-1 ${isActive ? "text-default" : "text-subtle"}`}
          >
            {isLast ? "└──" : "├──"}
          </span>
          <div className="flex-1 min-w-0 truncate" title={scenario.name}>
            {scenario.name}
          </div>
        </div>
      </StyledItem>
      <DD.Root>
        <DD.Trigger asChild>
          <button className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/scenario:opacity-100 data-[state=open]:opacity-100 p-1 rounded-sm hover:bg-base-hover text-subtle">
            <MoreActionsIcon size="md" />
          </button>
        </DD.Trigger>
        <DD.Portal>
          <DDContent side="right" align="start" sideOffset={4}>
            <StyledItem onSelect={() => onRename(scenario.id, scenario.name)}>
              <RenameIcon size="sm" />
              <span>{translate("scenarios.rename")}</span>
            </StyledItem>

            <StyledItem onSelect={() => onDuplicate(scenario.id)}>
              <DuplicateIcon size="sm" />
              <span>{translate("scenarios.duplicate")}</span>
            </StyledItem>

            <StyledItem
              onSelect={() => onDelete(scenario.id, scenario.name)}
              className="text-error"
            >
              <DeleteIcon size="sm" />
              <span>{translate("scenarios.delete")}</span>
            </StyledItem>
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
};
