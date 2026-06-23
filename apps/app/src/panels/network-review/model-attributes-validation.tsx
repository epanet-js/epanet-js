import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { ErrorIcon, WarningIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { useSelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { modelAttributesValidationIssuesAtom } from "src/state/network-review";
import {
  EntityType,
  groupIssues,
  validateModelAttributes,
  ValidationGroup,
  ValidationIssue,
} from "src/lib/model-attributes-validation";
import {
  CheckType,
  EmptyState,
  LoadingState,
  ToolDescription,
  ToolHeader,
  useLoadingStatus,
  VirtualizedIssuesList,
} from "./common";

const ruleLabelKeys: Record<string, string> = {
  "pipe.roughness.present":
    "networkReview.modelAttributesValidation.rule.roughnessPresent",
  "pipe.roughness.positive":
    "networkReview.modelAttributesValidation.rule.roughnessPositive",
  "customerPoint.connected":
    "networkReview.modelAttributesValidation.rule.customerPointConnected",
};

type ValidationRow =
  | { kind: "group"; id: string; group: ValidationGroup }
  | {
      kind: "issue";
      id: string;
      entityType: EntityType;
      issue: ValidationIssue;
    };

const groupRowId = (ruleId: string) => `group:${ruleId}`;
const issueRowId = (ruleId: string, entityId: number) =>
  `issue:${ruleId}:${entityId}`;

export const buildRows = (
  groups: ValidationGroup[],
  expandedRuleIds: Set<string>,
): ValidationRow[] => {
  const rows: ValidationRow[] = [];
  for (const group of groups) {
    rows.push({ kind: "group", id: groupRowId(group.ruleId), group });
    if (expandedRuleIds.has(group.ruleId)) {
      for (const issue of group.issues) {
        rows.push({
          kind: "issue",
          id: issueRowId(group.ruleId, issue.entityId),
          entityType: group.entityType,
          issue,
        });
      }
    }
  }
  return rows;
};

const countIssues = (groups: ValidationGroup[]): number =>
  groups.reduce((total, group) => total + group.issues.length, 0);

export const ModelAttributesValidation = ({
  onGoBack,
}: {
  onGoBack: () => void;
}) => {
  const userTracking = useUserTracking();
  const { groups, checkModelAttributesValidation, isLoading, isReady } =
    useCheckModelAttributesValidation();
  const selection = useAtomValue(selectionAtom);
  const {
    selectAsset,
    selectAssets,
    selectCustomerPoint,
    selectCustomerPoints,
    clearSelection,
  } = useSelection(selection);
  const zoomTo = useZoomTo();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(
    new Set(),
  );

  const issuesCount = countIssues(groups);
  const lastIssuesCount = useRef(0);
  const rows = useMemo(
    () => buildRows(groups, expandedRuleIds),
    [groups, expandedRuleIds],
  );

  useEffect(
    function recomputeModelAttributesValidation() {
      const abortController = new AbortController();
      void checkModelAttributesValidation(abortController.signal);
      return () => {
        abortController.abort();
      };
    },
    [checkModelAttributesValidation],
  );

  const zoomToAssets = useCallback(
    (entityIds: number[]) => {
      const assets = entityIds
        .map((id) => hydraulicModel.assets.get(id))
        .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset));
      if (assets.length > 0) zoomTo(assets);
    },
    [hydraulicModel, zoomTo],
  );

  const selectEntities = useCallback(
    (entityType: EntityType, entityIds: number[]) => {
      if (entityType === "customerPoint") {
        selectCustomerPoints(entityIds);
        return;
      }
      selectAssets(entityIds);
      zoomToAssets(entityIds);
    },
    [selectAssets, selectCustomerPoints, zoomToAssets],
  );

  const selectEntity = useCallback(
    (entityType: EntityType, entityId: number) => {
      if (entityType === "customerPoint") {
        selectCustomerPoint(entityId);
        return;
      }
      selectAsset(entityId);
      zoomToAssets([entityId]);
    },
    [selectAsset, selectCustomerPoint, zoomToAssets],
  );

  const toggleExpand = useCallback((ruleId: string) => {
    setExpandedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  }, []);

  const selectRow = useCallback(
    (row: ValidationRow | null) => {
      if (!row) {
        setSelectedRowId(null);
        clearSelection();
        return;
      }

      setSelectedRowId(row.id);

      if (row.kind === "group") {
        setExpandedRuleIds((prev) => new Set(prev).add(row.group.ruleId));
        selectEntities(
          row.group.entityType,
          row.group.issues.map((issue) => issue.entityId),
        );
        return;
      }

      selectEntity(row.entityType, row.issue.entityId);
    },
    [clearSelection, selectEntities, selectEntity],
  );

  useEffect(() => {
    if (lastIssuesCount.current !== issuesCount) {
      lastIssuesCount.current = issuesCount;
      userTracking.capture({
        name: "networkReview.modelAttributesValidation.changed",
        count: issuesCount,
      });
    }
  }, [issuesCount, userTracking]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        checkType={CheckType.modelAttributesValidation}
        onGoBack={onGoBack}
        itemsCount={issuesCount}
        autoFocus={issuesCount === 0 && !isLoading}
      />
      <div className="relative grow flex flex-col">
        {isReady ? (
          <>
            {rows.length > 0 ? (
              <ModelAttributesValidationList
                rows={rows}
                onClick={selectRow}
                selectedRowId={selectedRowId}
                expandedRuleIds={expandedRuleIds}
                onToggleExpand={toggleExpand}
                onGoBack={onGoBack}
              />
            ) : (
              <>
                <ToolDescription
                  checkType={CheckType.modelAttributesValidation}
                />
                <EmptyState checkType={CheckType.modelAttributesValidation} />
              </>
            )}
            {isLoading && <LoadingState overlay />}
          </>
        ) : (
          <>
            <ToolDescription checkType={CheckType.modelAttributesValidation} />
            <LoadingState />
          </>
        )}
      </div>
    </div>
  );
};

const ModelAttributesValidationList = ({
  rows,
  onClick,
  selectedRowId,
  expandedRuleIds,
  onToggleExpand,
  onGoBack,
}: {
  rows: ValidationRow[];
  onClick: (row: ValidationRow | null) => void;
  selectedRowId: string | null;
  expandedRuleIds: Set<string>;
  onToggleExpand: (ruleId: string) => void;
  onGoBack: () => void;
}) => {
  return (
    <VirtualizedIssuesList
      items={rows}
      selectedItemId={selectedRowId}
      onSelect={onClick}
      getItemId={(row) => row.id}
      renderItem={(_index, row, selectedId, onClick) =>
        row.kind === "group" ? (
          <ModelAttributesValidationGroupItem
            row={row}
            selectedId={selectedId}
            onClick={onClick}
            isExpanded={expandedRuleIds.has(row.group.ruleId)}
            onToggleExpand={onToggleExpand}
          />
        ) : (
          <ModelAttributesValidationIssueItem
            row={row}
            selectedId={selectedId}
            onClick={onClick}
          />
        )
      }
      checkType={CheckType.modelAttributesValidation}
      estimateSize={44}
      onGoBack={onGoBack}
    />
  );
};

const SeverityIcon = ({ severity }: { severity: "error" | "warning" }) => (
  <span
    className={
      severity === "error"
        ? "text-red-600 dark:text-red-400"
        : "text-orange-500 dark:text-orange-400"
    }
  >
    {severity === "error" ? <ErrorIcon /> : <WarningIcon />}
  </span>
);

const ModelAttributesValidationGroupItem = ({
  row,
  onClick,
  selectedId,
  isExpanded,
  onToggleExpand,
}: {
  row: Extract<ValidationRow, { kind: "group" }>;
  onClick: (row: ValidationRow) => void;
  selectedId: string | null;
  isExpanded: boolean;
  onToggleExpand: (ruleId: string) => void;
}) => {
  const translate = useTranslate();
  const { group } = row;
  const isSelected = selectedId === row.id;
  const label = translate(
    ruleLabelKeys[group.ruleId] ??
      "networkReview.modelAttributesValidation.title",
  );
  const affectedText = translate(
    "networkReview.modelAttributesValidation.affectedCount",
    group.issues.length,
  );

  return (
    <Button
      onClick={() => onClick(row)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      role="button"
      aria-label={translate(
        "networkReview.modelAttributesValidation.issueLabel",
        label,
        String(group.issues.length),
      )}
      aria-checked={isSelected}
      aria-expanded={isExpanded ? "true" : "false"}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 items-start p-1 pr-0 text-size-base w-full text-left">
        <div className="pt-[.125rem]">
          <SeverityIcon severity={group.severity} />
        </div>
        <div className="flex flex-col items-start">
          <span className="font-bold">{label}</span>
          <span className="text-subtle">{affectedText}</span>
        </div>
        <span
          role="button"
          aria-label={translate(
            isExpanded
              ? "networkReview.modelAttributesValidation.collapse"
              : "networkReview.modelAttributesValidation.expand",
          )}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(group.ruleId);
          }}
          className="pt-[.125rem] text-subtle"
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </div>
    </Button>
  );
};

const ModelAttributesValidationIssueItem = ({
  row,
  onClick,
  selectedId,
}: {
  row: Extract<ValidationRow, { kind: "issue" }>;
  onClick: (row: ValidationRow) => void;
  selectedId: string | null;
}) => {
  const isSelected = selectedId === row.id;
  const label = row.issue.label ?? String(row.issue.entityId);

  return (
    <Button
      onClick={() => onClick(row)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      role="button"
      aria-label={label}
      aria-checked={isSelected}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div className="flex items-center p-1 pl-8 pr-0 text-size-base w-full text-left">
        <span className="truncate">{label}</span>
      </div>
    </Button>
  );
};

const deferToAllowRender = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const useCheckModelAttributesValidation = () => {
  const [groups, setGroups] = useState<ValidationGroup[]>([]);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const setIssues = useSetAtom(modelAttributesValidationIssuesAtom);
  const { startLoading, finishLoading, isLoading } = useLoadingStatus();
  const isReady = useRef(false);

  const checkModelAttributesValidation = useCallback(
    async (signal?: AbortSignal) => {
      startLoading();
      await deferToAllowRender();

      if (signal?.aborted) return;

      try {
        const issues = await validateModelAttributes(hydraulicModel, {
          signal,
        });

        if (!signal?.aborted) {
          setIssues(issues);
          setGroups(groupIssues(issues));
          finishLoading();
          isReady.current = true;
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        finishLoading();
        throw error;
      }
    },
    [hydraulicModel, startLoading, finishLoading, setIssues],
  );

  return {
    checkModelAttributesValidation,
    groups,
    isLoading,
    isReady: isReady.current,
  };
};
