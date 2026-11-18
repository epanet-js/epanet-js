import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import {
  ActiveAssetIndex,
  ActiveTopology,
  AssetId,
  configuredAllowedFlowDirections,
} from "@epanet-js/hydraulic-model";
import {
  findReturnPath,
  JUNCTION_WITHOUT_SUPPLY_RULE_ID,
  listTopologyIssues,
  PUMP_FEEDING_ITSELF_RULE_ID,
  VALVE_FEEDING_ITSELF_RULE_ID,
  type TopologyIssue,
  type TopologyIssues,
} from "@epanet-js/network-review";
import { HydraulicModel } from "src/hydraulic-model";
import { WarningIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { CheckType } from "src/lib/network-review";
import { useCachedCheck, useReviewChecks } from "src/hooks/use-review-checks";
import { USelection, useSelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { reviewResultsAtom } from "src/state/network-review";
import {
  EmptyState,
  LoadingState,
  ToolDescription,
  ToolHeader,
  useCheckHeader,
  useLoadingStatus,
  VirtualizedIssuesList,
} from "./common";

export const TopologyChecks = ({ onGoBack }: { onGoBack: () => void }) => {
  const { issues, checkTopology, isLoading, isReady } = useCheckTopology();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const selection = useAtomValue(selectionAtom);
  const { selectAssets, clearSelection } = useSelection(selection);
  const zoomTo = useZoomTo();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  useEffect(
    function recomputeTopologyChecks() {
      const abortController = new AbortController();
      void checkTopology(abortController.signal).catch(() => {});
      return () => {
        abortController.abort();
      };
    },
    [checkTopology, hydraulicModel.version],
  );

  const selectIssue = useCallback(
    (issue: TopologyIssue | null) => {
      if (issue === null) {
        setSelectedIssueId(null);
        clearSelection();
        return;
      }

      const assetIds = assetsToSelect(issue, hydraulicModel);
      setSelectedIssueId(issueId(issue));
      selectAssets(assetIds);
      zoomTo(USelection.fromIds(assetIds, []));
    },
    [hydraulicModel, selectAssets, clearSelection, zoomTo],
  );

  const headerProps = useCheckHeader(
    CheckType.topologyChecks,
    issues.length,
    onGoBack,
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        {...headerProps}
        autoFocus={issues.length === 0 && !isLoading}
      />
      <div className="relative grow flex flex-col">
        {isReady ? (
          <>
            {issues.length > 0 ? (
              <VirtualizedIssuesList
                items={issues}
                selectedItemId={selectedIssueId}
                onSelect={selectIssue}
                getItemId={issueId}
                renderItem={(_index, issue, selectedId, onClick) => (
                  <TopologyIssueItem
                    issue={issue}
                    hydraulicModel={hydraulicModel}
                    isSelected={selectedId === issueId(issue)}
                    onClick={onClick}
                  />
                )}
                checkType={CheckType.topologyChecks}
                onGoBack={onGoBack}
              />
            ) : (
              <>
                <ToolDescription checkType={CheckType.topologyChecks} />
                <EmptyState checkType={CheckType.topologyChecks} />
              </>
            )}
            {isLoading && <LoadingState overlay />}
          </>
        ) : (
          <>
            <ToolDescription checkType={CheckType.topologyChecks} />
            <LoadingState />
          </>
        )}
      </div>
    </div>
  );
};

const TopologyIssueItem = ({
  issue,
  hydraulicModel,
  isSelected,
  onClick,
}: {
  issue: TopologyIssue;
  hydraulicModel: HydraulicModel;
  isSelected: boolean;
  onClick: (issue: TopologyIssue) => void;
}) => {
  const translate = useTranslate();
  const label = issueLabel(issue, hydraulicModel, translate);

  return (
    <Button
      onClick={() => onClick(issue)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      size="xxs"
      aria-label={label}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full hover:bg-transparent dark:hover:bg-transparent aria-selected:bg-transparent! aria-selected:hover:bg-transparent!"
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-2 items-center h-8 px-2 pr-0 text-size-base w-full">
        <div className="flex items-center text-warning">
          <WarningIcon />
        </div>
        <div className="text-size-base text-left truncate">{label}</div>
      </div>
    </Button>
  );
};

const issueId = (issue: TopologyIssue): string =>
  issue.ruleId === JUNCTION_WITHOUT_SUPPLY_RULE_ID
    ? issue.ruleId
    : `${issue.ruleId}:${issue.assetIds[0]}`;

const issueLabel = (
  issue: TopologyIssue,
  hydraulicModel: HydraulicModel,
  translate: ReturnType<typeof useTranslate>,
): string => {
  const [assetId] = issue.assetIds;
  const assetLabel = hydraulicModel.assets.get(assetId)?.label ?? "";

  switch (issue.ruleId) {
    case PUMP_FEEDING_ITSELF_RULE_ID:
      return translate(
        "networkReview.topologyChecks.pumpFeedingItself",
        assetLabel,
      );
    case VALVE_FEEDING_ITSELF_RULE_ID:
      return translate(
        "networkReview.topologyChecks.valveFeedingItself",
        assetLabel,
      );
    case JUNCTION_WITHOUT_SUPPLY_RULE_ID:
      return translate(
        "networkReview.topologyChecks.junctionsWithoutSupply",
        issue.assetIds.length,
      );
  }
};

const assetsToSelect = (
  issue: TopologyIssue,
  hydraulicModel: HydraulicModel,
): AssetId[] => {
  if (issue.ruleId === JUNCTION_WITHOUT_SUPPLY_RULE_ID) return issue.assetIds;

  const [linkId] = issue.assetIds;
  const returnPath = findReturnPath(
    linkId,
    new ActiveTopology(hydraulicModel.topology, hydraulicModel.assets),
    new ActiveAssetIndex(hydraulicModel.assetIndex, hydraulicModel.assets),
    configuredAllowedFlowDirections(hydraulicModel.assets),
  );
  if (returnPath === null) return [linkId];

  return [linkId, ...returnPath.linkIds, ...returnPath.nodeIds];
};

const noIssues: TopologyIssue[] = [];

const noTopologyIssues: TopologyIssues = {
  selfFeedingPumps: [],
  selfFeedingValves: [],
  junctionsWithoutSupply: [],
};

const useCheckTopology = () => {
  const entry = useAtomValue(reviewResultsAtom)[CheckType.topologyChecks];
  const { ensureFresh } = useReviewChecks();
  const { read } = useCachedCheck(CheckType.topologyChecks);
  const { startLoading, finishLoading, isLoading } = useLoadingStatus();
  const userTracking = useUserTracking();
  const lastIssuesCount = useRef(0);

  const checkTopology = useCallback(
    async (signal: AbortSignal) => {
      startLoading();
      try {
        await ensureFresh({ signal });
      } finally {
        if (!signal.aborted) finishLoading();
      }
      if (signal.aborted) return;

      const issuesCount = listTopologyIssues(read() ?? noTopologyIssues).length;
      if (lastIssuesCount.current === issuesCount) return;

      lastIssuesCount.current = issuesCount;
      userTracking.capture({
        name: "networkReview.topologyChecks.changed",
        count: issuesCount,
      });
    },
    [startLoading, finishLoading, ensureFresh, read, userTracking],
  );

  const issues = useMemo(
    () => (entry ? listTopologyIssues(entry.items) : noIssues),
    [entry],
  );

  return {
    checkTopology,
    issues,
    isLoading,
    isReady: entry !== undefined,
  };
};
