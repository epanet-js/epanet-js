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
  type TopologyIssue,
  type TopologyIssues,
  type TopologyRuleId,
} from "@epanet-js/network-review";
import { HydraulicModel } from "src/hydraulic-model";
import { useUserTracking } from "src/infra/user-tracking";
import { CheckType } from "src/lib/network-review";
import { useCachedCheck, useReviewChecks } from "src/hooks/use-review-checks";
import { USelection, useSelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { reviewResultsAtom } from "src/state/network-review";
import {
  EmptyState,
  IssueGroupRow,
  IssueGroupsList,
  LoadingState,
  ToolDescription,
  ToolHeader,
  useCheckHeader,
  useLoadingStatus,
  VirtualizedIssuesList,
} from "./common";
import { ruleLabelKey } from "./rule-labels";

export const TopologyChecks = ({ onGoBack }: { onGoBack: () => void }) => {
  const { issues, checkTopology, isLoading, isReady } = useCheckTopology();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [openRuleId, setOpenRuleId] = useState<TopologyRuleId | null>(null);

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

  const groups = useMemo(() => groupByRule(issues), [issues]);
  const openGroup = groups.find((group) => group.ruleId === openRuleId);

  const headerProps = useCheckHeader(
    CheckType.topologyChecks,
    issues.length,
    onGoBack,
  );

  if (openGroup) {
    return (
      <TopologyIssuesGroupDetail
        group={openGroup}
        hydraulicModel={hydraulicModel}
        onGoBack={() => setOpenRuleId(null)}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        {...headerProps}
        autoFocus={issues.length === 0 && !isLoading}
      />
      <div className="relative grow flex flex-col">
        {isReady ? (
          <>
            {groups.length > 0 ? (
              <IssueGroupsList
                groups={groups}
                getGroupId={getGroupRuleId}
                renderGroup={(group, isSelected, onClick) => (
                  <TopologyIssuesGroupRow
                    group={group}
                    isSelected={isSelected}
                    onClick={onClick}
                  />
                )}
                onOpen={(group) => setOpenRuleId(group.ruleId)}
                onGoBack={onGoBack}
                checkType={CheckType.topologyChecks}
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

type TopologyIssuesGroup = {
  ruleId: TopologyRuleId;
  issues: TopologyIssue[];
  affectedCount: number;
};

const groupByRule = (issues: TopologyIssue[]): TopologyIssuesGroup[] => {
  const groups = new Map<TopologyRuleId, TopologyIssuesGroup>();

  for (const issue of issues) {
    const group = groups.get(issue.ruleId) ?? {
      ruleId: issue.ruleId,
      issues: [],
      affectedCount: 0,
    };
    group.issues.push(issue);
    group.affectedCount += issue.assetIds.length;
    groups.set(issue.ruleId, group);
  }

  return [...groups.values()];
};

const getGroupRuleId = (group: TopologyIssuesGroup) => group.ruleId;

const TopologyIssuesGroupRow = ({
  group,
  isSelected,
  onClick,
}: {
  group: TopologyIssuesGroup;
  isSelected: boolean;
  onClick: () => void;
}) => {
  const translate = useTranslate();
  const label = translate(ruleLabelKey(group.ruleId));

  return (
    <IssueGroupRow
      label={label}
      affectedText={translate(
        "networkReview.topologyChecks.affectedCount",
        group.affectedCount,
      )}
      ariaLabel={translate(
        "networkReview.topologyChecks.groupLabel",
        label,
        String(group.affectedCount),
      )}
      severity="warning"
      isSelected={isSelected}
      onClick={onClick}
    />
  );
};

const TopologyIssuesGroupDetail = ({
  group,
  hydraulicModel,
  onGoBack,
}: {
  group: TopologyIssuesGroup;
  hydraulicModel: HydraulicModel;
  onGoBack: () => void;
}) => {
  const translate = useTranslate();
  const selection = useAtomValue(selectionAtom);
  const { selectAssets, clearSelection } = useSelection(selection);
  const zoomTo = useZoomTo();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

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

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        onGoBack={onGoBack}
        title={translate(ruleLabelKey(group.ruleId))}
        summary={translate(
          "networkReview.topologyChecks.affectedCount",
          group.affectedCount,
        )}
      />
      <div className="relative grow flex flex-col">
        {group.ruleId === JUNCTION_WITHOUT_SUPPLY_RULE_ID && (
          <p className="text-size-base w-full p-3">
            {translate("networkReview.topologyChecks.interruptionCausedBy")}
          </p>
        )}
        <VirtualizedIssuesList
          items={group.issues}
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
          estimateSize={36}
          showDescription={false}
          onGoBack={onGoBack}
        />
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
      <div className="p-2 pr-0 text-size-base text-left truncate w-full">
        {label}
      </div>
    </Button>
  );
};

const issueId = (issue: TopologyIssue): string =>
  `${issue.ruleId}:${issue.assetIds[0]}`;

const issueLabel = (
  issue: TopologyIssue,
  hydraulicModel: HydraulicModel,
  translate: ReturnType<typeof useTranslate>,
): string => {
  if (issue.ruleId !== JUNCTION_WITHOUT_SUPPLY_RULE_ID)
    return hydraulicModel.assets.get(issue.assetIds[0])?.label ?? "";

  const [blockingLink, ...otherBlockingLinks] = issue.blockingLinkIds
    .map((linkId) => hydraulicModel.assets.get(linkId))
    .filter((link) => link !== undefined);

  if (!blockingLink)
    return translate(
      "networkReview.topologyChecks.junctionsWithoutSupply",
      issue.assetIds.length,
    );

  return otherBlockingLinks.length > 0
    ? translate(
        "networkReview.topologyChecks.linkAndMore",
        blockingLink.label,
        String(otherBlockingLinks.length),
      )
    : blockingLink.label;
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
