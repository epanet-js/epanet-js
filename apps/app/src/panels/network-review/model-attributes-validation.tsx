import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { Button } from "src/components/elements";
import { Action } from "src/components/action-button";
import { useTranslate } from "src/hooks/use-translate";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { ErrorIcon, PointerClickIcon, WarningIcon } from "src/icons";
import { pluralize } from "src/lib/utils";
import { usePermissions } from "src/hooks/use-permissions";
import { PaywallFade, PaywallUpgradeBox } from "src/components/form/paywall";
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
  useCheckHeader,
  useLoadingStatus,
  VirtualizedIssuesList,
} from "./common";

// Rule ids map to a camelCase translation key under the rule namespace, e.g.
// "pipe.diameter.present" -> "...rule.pipeDiameterPresent". Every rule in
// lib/model-attributes-validation/rules.ts must have a matching entry.
const toRuleLabelToken = (ruleId: string) =>
  ruleId
    .split(".")
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("");

const ruleLabelKey = (ruleId: string) =>
  `networkReview.modelAttributesValidation.rule.${toRuleLabelToken(ruleId)}`;

const countIssues = (groups: ValidationGroup[]): number =>
  groups.reduce((total, group) => total + group.issues.length, 0);

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

export const ModelAttributesValidation = ({
  onGoBack,
}: {
  onGoBack: () => void;
}) => {
  const userTracking = useUserTracking();
  const { canValidateModelAttributes } = usePermissions();
  const { groups, checkModelAttributesValidation, isLoading, isReady } =
    useCheckModelAttributesValidation();
  const selection = useAtomValue(selectionAtom);
  const {
    selectAsset,
    selectAssets,
    selectCustomerPoint,
    selectCustomerPoints,
  } = useSelection(selection);
  const zoomTo = useZoomTo();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [detailRuleId, setDetailRuleId] = useState<string | null>(null);

  const issuesCount = countIssues(groups);
  const lastIssuesCount = useRef(0);

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

  const openGroup = useCallback(
    (group: ValidationGroup) => {
      selectEntities(
        group.entityType,
        group.issues.map((issue) => issue.entityId),
      );
      setDetailRuleId(group.ruleId);
    },
    [selectEntities],
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

  const detailGroup = detailRuleId
    ? (groups.find((group) => group.ruleId === detailRuleId) ?? null)
    : null;

  useEffect(
    function leaveDetailWhenGroupResolved() {
      if (isReady && detailRuleId && !detailGroup) {
        setDetailRuleId(null);
      }
    },
    [isReady, detailRuleId, detailGroup],
  );

  const headerProps = useCheckHeader(
    CheckType.modelAttributesValidation,
    issuesCount,
    onGoBack,
  );

  if (detailGroup) {
    return (
      <ModelAttributesValidationDetail
        group={detailGroup}
        onGoBack={() => setDetailRuleId(null)}
        onSelectIssue={(issue) =>
          selectEntity(detailGroup.entityType, issue.entityId)
        }
        onSelectAll={() =>
          selectEntities(
            detailGroup.entityType,
            detailGroup.issues.map((issue) => issue.entityId),
          )
        }
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        {...headerProps}
        autoFocus={issuesCount === 0 && !isLoading}
      />
      <div className="relative grow flex flex-col">
        {isReady ? (
          <>
            {groups.length > 0 ? (
              canValidateModelAttributes ? (
                <ModelAttributesValidationGroupList
                  groups={groups}
                  onOpen={openGroup}
                  onGoBack={onGoBack}
                />
              ) : (
                <ModelAttributesValidationLockedList groups={groups} />
              )
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

const ModelAttributesValidationGroupList = ({
  groups,
  onOpen,
  onGoBack,
}: {
  groups: ValidationGroup[];
  onOpen: (group: ValidationGroup) => void;
  onGoBack: () => void;
}) => {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(function autoFocusOnMount() {
    const timer = setTimeout(() => {
      containerRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = groups.findIndex(
        (group) => group.ruleId === selectedRuleId,
      );
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedRuleId(
            groups[Math.min(currentIndex + 1, groups.length - 1)].ruleId,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedRuleId(groups[Math.max(currentIndex - 1, 0)].ruleId);
          break;
        case "Enter":
          e.preventDefault();
          if (currentIndex !== -1) onOpen(groups[currentIndex]);
          break;
        case "Escape":
          e.preventDefault();
          onGoBack();
          break;
      }
    },
    [groups, selectedRuleId, onOpen, onGoBack],
  );

  return (
    <div className="flex-auto flex flex-col min-h-0">
      <ToolDescription checkType={CheckType.modelAttributesValidation} />
      <div
        ref={containerRef}
        className="flex-auto overflow-y-auto placemark-scrollbar px-1"
        style={{ contain: "strict" }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {groups.map((group) => (
          <ModelAttributesValidationGroupRow
            key={group.ruleId}
            group={group}
            isSelected={selectedRuleId === group.ruleId}
            onClick={() => onOpen(group)}
          />
        ))}
      </div>
    </div>
  );
};

const ModelAttributesValidationGroupRow = ({
  group,
  isSelected,
  onClick,
  locked = false,
}: {
  group: ValidationGroup;
  isSelected: boolean;
  onClick?: () => void;
  locked?: boolean;
}) => {
  const translate = useTranslate();
  const label = translate(ruleLabelKey(group.ruleId));
  const affectedText = translate(
    "networkReview.modelAttributesValidation.affectedCount",
    group.issues.length,
  );

  return (
    <Button
      onClick={onClick}
      variant={"quiet/list"}
      aria-label={translate(
        "networkReview.modelAttributesValidation.issueLabel",
        label,
        String(group.issues.length),
      )}
      aria-selected={isSelected}
      className="group w-full"
    >
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 items-start p-2 pr-0 text-size-base w-full text-left">
        <div className="pt-[.125rem]">
          <SeverityIcon severity={group.severity} />
        </div>
        <div className="flex flex-col items-start">
          <span className="font-bold">{label}</span>
          <span className="text-subtle">{affectedText}</span>
        </div>
        <div
          className={`pt-[.125rem] transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {locked ? <Lock size={16} /> : <ChevronRight size={16} />}
        </div>
      </div>
    </Button>
  );
};

const ModelAttributesValidationLockedList = ({
  groups,
}: {
  groups: ValidationGroup[];
}) => {
  const translate = useTranslate();

  return (
    <>
      <PaywallFade
        feature="modelAttributesValidation"
        className="flex-auto flex flex-col min-h-0"
      >
        <ToolDescription checkType={CheckType.modelAttributesValidation} />
        <div
          className="flex-auto overflow-y-auto placemark-scrollbar px-1"
          style={{ contain: "strict" }}
        >
          {groups.map((group) => (
            <ModelAttributesValidationGroupRow
              key={group.ruleId}
              group={group}
              isSelected={false}
              locked
            />
          ))}
        </div>
      </PaywallFade>
      <div className="absolute inset-x-0 bottom-0">
        <PaywallUpgradeBox
          feature="modelAttributesValidation"
          title={translate(
            "networkReview.modelAttributesValidation.upgrade.title",
          )}
          description={translate(
            "networkReview.modelAttributesValidation.upgrade.description",
          )}
        />
      </div>
    </>
  );
};

const ModelAttributesValidationDetail = ({
  group,
  onGoBack,
  onSelectIssue,
  onSelectAll,
}: {
  group: ValidationGroup;
  onGoBack: () => void;
  onSelectIssue: (issue: ValidationIssue) => void;
  onSelectAll: () => void;
}) => {
  const translate = useTranslate();
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);

  const selectIssue = useCallback(
    (issue: ValidationIssue | null) => {
      if (!issue) {
        setSelectedEntityId(null);
        return;
      }
      setSelectedEntityId(issue.entityId);
      onSelectIssue(issue);
    },
    [onSelectIssue],
  );

  const selectAllAction: Action = {
    icon: <PointerClickIcon />,
    label: `${translate("select")} ${pluralize(
      translate,
      group.entityType,
      group.issues.length,
      false,
    )}`,
    applicable: true,
    onSelect: () => {
      onSelectAll();
      return Promise.resolve();
    },
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        onGoBack={onGoBack}
        title={translate(ruleLabelKey(group.ruleId))}
        summary={translate(
          "networkReview.modelAttributesValidation.affectedCount",
          group.issues.length,
        )}
        actions={[selectAllAction]}
      />
      <div className="relative grow flex flex-col">
        <VirtualizedIssuesList
          items={group.issues}
          selectedItemId={selectedEntityId}
          onSelect={selectIssue}
          getItemId={(issue) => issue.entityId}
          renderItem={(_index, issue, selectedId, onClick) => (
            <ModelAttributesValidationEntityRow
              issue={issue}
              isSelected={selectedId === issue.entityId}
              onClick={onClick}
            />
          )}
          checkType={CheckType.modelAttributesValidation}
          showDescription={false}
          onGoBack={onGoBack}
        />
      </div>
    </div>
  );
};

const ModelAttributesValidationEntityRow = ({
  issue,
  isSelected,
  onClick,
}: {
  issue: ValidationIssue;
  isSelected: boolean;
  onClick: (issue: ValidationIssue) => void;
}) => {
  const label = issue.label ?? String(issue.entityId);

  return (
    <Button
      onClick={() => onClick(issue)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      aria-label={label}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div className="flex items-center p-1 pr-0 text-size-base w-full text-left">
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
