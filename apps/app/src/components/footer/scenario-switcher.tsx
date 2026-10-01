import { useEffect, useState } from "react";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Branch } from "@epanet-js/worktree";
import * as Tooltip from "@radix-ui/react-tooltip";
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
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { notify } from "src/components/notifications";
import { useUserTracking } from "src/infra/user-tracking";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { worktreeAtom, scenariosListAtom } from "src/state/scenarios";
import { dialogAtom } from "src/state/dialog";
import { useCreateScenario } from "src/commands/create-scenario";
import { useSwitchToBranch } from "src/commands/switch-scenario";
import { useFeatureLock } from "src/components/form/paywall";
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
  const worktree = useAtomValue(worktreeAtom);
  const scenariosList = useAtomValue(scenariosListAtom);
  const setDialog = useSetAtom(dialogAtom);
  const createScenario = useCreateScenario();

  const {
    scenariosAvailable,
    switchToMain,
    deleteScenarioById,
    duplicateScenarioById,
    renameScenarioById,
  } = useScenarioOperations();
  const switchToBranch = useSwitchToBranch();
  const { isLocked: isManageLocked, openPaywall: openManagePaywall } =
    useFeatureLock("manageScenarios");

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
    if (isManageLocked) return openManagePaywall();
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
    if (isManageLocked) return openManagePaywall();
    setDialog({
      type: "renameScenario",
      scenarioId,
      currentName: scenarioName,
      onConfirm: handleRenameScenario,
    });
  };

  const handleDuplicateScenario = (scenarioId: string) => {
    if (isManageLocked) return openManagePaywall();
    const duplicated = duplicateScenarioById(scenarioId);
    if (!duplicated) return;

    userTracking.capture({
      name: "scenario.duplicated",
      sourceScenarioId: scenarioId,
      ...duplicated,
    });

    notify({
      variant: "success",
      title: "Scenario duplicated",
      Icon: SuccessIcon,
      duration: 3000,
    });
  };

  if (!scenariosAvailable) return null;

  const hasScenarios = scenariosList.length > 0;

  if (!hasScenarios) {
    return (
      <div className="min-w-44 flex items-center">
        <Tooltip.Root delayDuration={200}>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleCreateScenario}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-size-base text-accent-hover bg-accent-tint hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
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
      <div className="w-44 h-10 group bn flex items-stretch py-1 focus:outline-hidden">
        <DD.Root
          onOpenChange={(open) => {
            if (open) {
              userTracking.capture({ name: "scenarioSwitcher.opened" });
            }
          }}
        >
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild disabled={isPlaying}>
              <Button
                variant="quiet"
                className="w-full justify-between"
                disabled={isPlaying}
              >
                <div className="flex items-center gap-1">
                  {isMainActive ? (
                    <MainModelIcon size="sm" />
                  ) : (
                    <ScenarioIcon size="sm" />
                  )}
                  <span className="truncate text-size-base">
                    {activeDisplayName}
                  </span>
                </div>
                <ChevronDownIcon size="sm" />
              </Button>
            </DD.Trigger>
          </Tooltip.Trigger>
          <DD.Portal>
            <DDContent align="start" side="top" className="min-w-64">
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
      <TContent side="top">
        <StyledTooltipArrow />
        {translate("scenarios.switcherTooltip")}
      </TContent>
    </Tooltip.Root>
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
  const isDuplicateScenarioOn = useFeatureFlag("FLAG_DUPLICATE_SCENARIO");

  return (
    <div className="relative group/scenario">
      <StyledItem
        onSelect={() => onSelect(scenario.id)}
        className={`pr-10 ${isActive ? "bg-accent-tint!" : "group-hover/scenario:bg-base-hover"}`}
      >
        <div className="flex items-center w-full gap-2">
          <span
            aria-hidden="true"
            className={`font-mono text-size-base pl-1 ${isActive ? "text-default" : "text-subtle"}`}
          >
            {isLast ? "└──" : "├──"}
          </span>
          <div className="flex-1">{scenario.name}</div>
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

            {isDuplicateScenarioOn && (
              <StyledItem onSelect={() => onDuplicate(scenario.id)}>
                <DuplicateIcon size="sm" />
                <span>{translate("duplicate")}</span>
              </StyledItem>
            )}

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
