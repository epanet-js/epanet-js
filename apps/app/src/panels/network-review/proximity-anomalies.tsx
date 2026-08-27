import { NumericField } from "src/components/form/numeric-field";
import { localizeDecimal } from "@epanet-js/i18n";

import {
  CheckType,
  ProximityAnomaly,
  findProximityAnomalies,
} from "src/lib/network-review";
import clsx from "clsx";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useArchivedItems } from "./use-archived-items";
import { FixProximityAnomalyButton } from "./fixes/fix-proximity-anomaly-button";
import { useFixProximityAnomaly } from "./fixes/use-fix-proximity-anomaly";
import {
  Archiving,
  EmptyState,
  LoadingState,
  ToolDescription,
  ToolHeader,
  useCheckHeader,
  useLoadingStatus,
  VirtualizedIssuesList,
} from "./common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { proximityDistanceAtom } from "src/state/network-review";
import { selectionAtom } from "src/state/selection";
import { useTranslate } from "src/hooks/use-translate";
import { convertTo, Quantity } from "@epanet-js/quantity";
import { useSelection, USelection } from "src/selection";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import { Button } from "src/components/elements";
import { Maybe } from "purify-ts/Maybe";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import { InlineField } from "src/components/form/fields";

export const ProximityAnomalies = ({ onGoBack }: { onGoBack: () => void }) => {
  const userTracking = useUserTracking();
  const { checkProximityAnomalies, proximityAnomalies, isLoading, isReady } =
    useCheckProximityAnomalies();
  const { distanceInM, localizedDistance, updateDistance } = useDistance();
  const selection = useAtomValue(selectionAtom);
  const { setSelection, isSelected, clearSelection } = useSelection(selection);
  const zoomTo = useZoomTo();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selectedProximityAnomalyId, setSelectedProximityAnomalyId] = useState<
    string | null
  >(null);

  const lastIssuesCount = useRef(0);
  const distanceInputRef = useRef<HTMLDivElement>(null);

  useEffect(
    function recomputeProximityAnomalies() {
      const abortController = new AbortController();
      void checkProximityAnomalies(distanceInM, abortController.signal);
      return () => {
        abortController.abort();
      };
    },
    [distanceInM, checkProximityAnomalies],
  );

  const selectProximityAnomaly = useCallback(
    (anomaly: ProximityAnomaly | null) => {
      if (!anomaly) {
        setSelectedProximityAnomalyId(null);
        clearSelection();
        return;
      }
      const nodeAsset = hydraulicModel.assets.get(anomaly.nodeId);
      const pipeAsset = hydraulicModel.assets.get(anomaly.pipeId);
      if (!nodeAsset || !pipeAsset) {
        setSelectedProximityAnomalyId(null);
        return;
      }
      const connectionId = proximityAnomalyId(anomaly);
      setSelectedProximityAnomalyId(connectionId);
      setSelection(USelection.fromAssetIds([anomaly.nodeId, anomaly.pipeId]));

      const nodeGeometry = nodeAsset.feature.geometry as GeoJSON.Point;
      const boundingBox = bbox(
        lineString([nodeGeometry.coordinates, anomaly.nearestPointOnPipe]),
      );
      zoomTo(Maybe.of(boundingBox), 20);
    },
    [clearSelection, hydraulicModel.assets, setSelection, zoomTo],
  );

  useEffect(() => {
    const selectedAnomaly = proximityAnomalies.find((anomaly) =>
      isSelected(anomaly.nodeId),
    );

    if (!selectedAnomaly) {
      setSelectedProximityAnomalyId(null);
    } else {
      const connectionId = proximityAnomalyId(selectedAnomaly);
      setSelectedProximityAnomalyId((prev) =>
        prev === connectionId ? prev : connectionId,
      );
    }
  }, [proximityAnomalies, isSelected]);

  useEffect(() => {
    if (isLoading) return;
    const issuesCount = proximityAnomalies.length;
    if (lastIssuesCount.current !== issuesCount) {
      lastIssuesCount.current = issuesCount;
      userTracking.capture({
        name: "networkReview.proximityAnomalies.changed",
        count: issuesCount,
        distance: localizedDistance.value,
        units: localizedDistance.unit || "",
      });
    }
  }, [proximityAnomalies, userTracking, localizedDistance, isLoading]);

  useEffect(
    function autoFocusDistanceInputWhenNoResults() {
      if (proximityAnomalies.length === 0 && distanceInputRef.current) {
        const timer = setTimeout(() => {
          const input = distanceInputRef.current?.querySelector("input");
          input?.focus();
        }, 100);
        return () => clearTimeout(timer);
      }
    },
    [proximityAnomalies.length],
  );

  const isFixPipeOverUnderShotOn = useFeatureFlag(
    "FLAG_FIX_PIPE_OVER_UNDER_SHOT",
  );
  const archiving = useArchivedItems(CheckType.proximityAnomalies);
  const { isArchived } = archiving;

  const activeCount = useMemo(
    () =>
      isFixPipeOverUnderShotOn
        ? proximityAnomalies.filter(
            (item) => !isArchived(proximityAnomalyId(item)),
          ).length
        : proximityAnomalies.length,
    [proximityAnomalies, isArchived, isFixPipeOverUnderShotOn],
  );

  const headerProps = useCheckHeader(
    CheckType.proximityAnomalies,
    activeCount,
    onGoBack,
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        {...headerProps}
        autoFocus={proximityAnomalies.length === 0 && !isLoading}
      />
      <DistanceInput
        distance={localizedDistance}
        onChange={updateDistance}
        inputRef={distanceInputRef}
        disabled={isLoading}
      />
      <div className="relative grow flex flex-col">
        {isReady ? (
          <>
            {proximityAnomalies.length > 0 ? (
              <ProximityAnomaliesList
                proximityAnomalies={proximityAnomalies}
                onSelect={selectProximityAnomaly}
                selectedAnomaly={selectedProximityAnomalyId}
                onGoBack={onGoBack}
                archiving={isFixPipeOverUnderShotOn ? archiving : undefined}
              />
            ) : (
              <>
                <ToolDescription checkType={CheckType.proximityAnomalies} />
                <EmptyState checkType={CheckType.proximityAnomalies} />
              </>
            )}
            {isLoading && <LoadingState overlay />}
          </>
        ) : (
          <>
            <ToolDescription checkType={CheckType.proximityAnomalies} />
            <LoadingState />
          </>
        )}
      </div>
    </div>
  );
};

const proximityAnomalyId = (anomaly: ProximityAnomaly) =>
  `${anomaly.nodeId}-${anomaly.pipeId}`;

const DEFAULT_DISTANCE_FT = 1.5;
const DEFAULT_DISTANCE_M = 0.5;

const DistanceInput = ({
  onChange,
  distance,
  inputRef,
  disabled = false,
}: {
  onChange: (distance: number) => void;
  distance: Quantity;
  inputRef?: React.RefObject<HTMLDivElement>;
  disabled?: boolean;
}) => {
  const translate = useTranslate();

  const label = `${translate("networkReview.proximityAnomalies.distance")} (${distance.unit})`;

  return (
    <div
      ref={inputRef}
      className="flex gap-2 p-3 border-b items-center flex-wrap"
    >
      <InlineField layout="label-flex-none" name={label}>
        <NumericField
          label={label}
          displayValue={localizeDecimal(distance.value)}
          onChangeValue={onChange}
          styleOptions={{ padding: "md", textSize: "sm" }}
          disabled={disabled}
        />
      </InlineField>
    </div>
  );
};

const useDistance = () => {
  const { units } = useAtomValue(projectSettingsAtom);
  const userTracking = useUserTracking();
  const unit = units.length;
  const [storedDistance, setStoredDistance] = useAtom(proximityDistanceAtom);

  // Stored with its own unit, so the number the user typed is shown back
  // verbatim; only a mid-session unit change needs converting.
  const distance = useMemo((): number => {
    if (!storedDistance) {
      return unit === "ft" ? DEFAULT_DISTANCE_FT : DEFAULT_DISTANCE_M;
    }

    return storedDistance.unit === unit
      ? storedDistance.value
      : convertTo(storedDistance, unit);
  }, [storedDistance, unit]);

  // Only reached from the input's commit, so this records values the user chose
  // and never the unit default.
  const updateDistance = useCallback(
    (value: number) => {
      setStoredDistance({ value, unit });

      userTracking.capture({
        name: "networkReview.proximityAnomalies.distanceSet",
        distance: value,
        units: unit ?? "",
      });
    },
    [unit, setStoredDistance, userTracking],
  );

  return {
    distanceInM: convertTo({ value: distance, unit }, "m"),
    localizedDistance: { value: distance, unit },
    updateDistance,
  };
};

const deferToAllowRender = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const useCheckProximityAnomalies = () => {
  const [proximityAnomalies, setProximityAnomalies] = useState<
    ProximityAnomaly[]
  >([]);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { startLoading, finishLoading, isLoading } = useLoadingStatus();
  const isReady = useRef(false);

  const checkProximityAnomalies = useCallback(
    async (distance: number, signal?: AbortSignal) => {
      startLoading();
      await deferToAllowRender();

      if (signal?.aborted) return;

      try {
        const result = await findProximityAnomalies(
          hydraulicModel,
          distance,
          "array",
          signal,
        );

        if (!signal?.aborted) {
          setProximityAnomalies(result);
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
    [hydraulicModel, startLoading, finishLoading],
  );

  return {
    checkProximityAnomalies,
    proximityAnomalies,
    isLoading,
    isReady: isReady.current,
  };
};

const ProximityAnomaliesList = ({
  proximityAnomalies,
  onSelect,
  selectedAnomaly,
  onGoBack,
  archiving,
}: {
  proximityAnomalies: ProximityAnomaly[];
  onSelect: (issue: ProximityAnomaly | null) => void;
  selectedAnomaly: string | null;
  onGoBack: () => void;
  archiving?: Archiving<string>;
}) => {
  const isFixPipeOverUnderShotOn = useFeatureFlag(
    "FLAG_FIX_PIPE_OVER_UNDER_SHOT",
  );
  const { fix } = useFixProximityAnomaly();

  const fixAnomaly = useCallback(
    (anomalyId: string) => {
      const anomaly = proximityAnomalies.find(
        (candidate) => proximityAnomalyId(candidate) === anomalyId,
      );
      if (!anomaly) return;

      fix(anomaly);
    },
    [proximityAnomalies, fix],
  );

  return (
    <VirtualizedIssuesList
      items={proximityAnomalies}
      selectedItemId={selectedAnomaly}
      onSelect={onSelect}
      getItemId={proximityAnomalyId}
      renderItem={(_index, anomaly, selectedId, onClick, isArchived) => (
        <ProximityAnomalyItem
          anomaly={anomaly}
          selectedId={selectedId}
          onClick={onClick}
          isArchived={isArchived}
        />
      )}
      renderItemAction={
        isFixPipeOverUnderShotOn
          ? (anomaly) => (
              <FixProximityAnomalyButton
                onFix={() => fixAnomaly(proximityAnomalyId(anomaly))}
              />
            )
          : undefined
      }
      onItemAction={isFixPipeOverUnderShotOn ? fixAnomaly : undefined}
      archiving={archiving}
      checkType={CheckType.proximityAnomalies}
      onGoBack={onGoBack}
    />
  );
};

const ProximityAnomalyItem = ({
  anomaly,
  onClick,
  selectedId,
  isArchived = false,
}: {
  anomaly: ProximityAnomaly;
  onClick: (anomaly: ProximityAnomaly) => void;
  selectedId: string | null;
  isArchived?: boolean;
}) => {
  const translate = useTranslate();
  const isFixPipeOverUnderShotOn = useFeatureFlag(
    "FLAG_FIX_PIPE_OVER_UNDER_SHOT",
  );
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { units } = useAtomValue(projectSettingsAtom);
  const connectionId = proximityAnomalyId(anomaly);
  const isSelected = selectedId === connectionId;

  const nodeAsset = hydraulicModel.assets.get(anomaly.nodeId);

  if (!nodeAsset) return null;

  const lengthUnit = units.length;
  const distanceInModelUnits = convertTo(
    { value: anomaly.distance, unit: "m" },
    lengthUnit,
  );
  const distanceFormatted = localizeDecimal(distanceInModelUnits, {
    decimals: 2,
  });

  return (
    <Button
      onClick={() => onClick(anomaly)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      size="xxs"
      aria-label={translate(
        "networkReview.proximityAnomalies.issueLabel",
        nodeAsset.label,
      )}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full hover:bg-transparent dark:hover:bg-transparent aria-selected:bg-transparent! aria-selected:hover:bg-transparent!"
    >
      <div
        className={clsx(
          "grid gap-x-2 items-center h-8 px-1 pr-0 text-size-base w-full",
          isFixPipeOverUnderShotOn
            ? "grid-cols-[minmax(0,auto)_auto] justify-start"
            : "grid-cols-[1fr_auto] justify-between",
        )}
      >
        <div
          className={clsx(
            "min-w-0 truncate text-left",
            isArchived && "text-subtle",
          )}
        >
          {nodeAsset.label}
        </div>
        <div
          className={clsx(
            "text-subtle",
            isFixPipeOverUnderShotOn ? "whitespace-nowrap" : "min-w-0",
          )}
        >
          {distanceFormatted} {lengthUnit}
        </div>
      </div>
    </Button>
  );
};
