import { NumericField } from "src/components/form/numeric-field";
import { localizeDecimal } from "src/infra/i18n/numbers";

import {
  CheckType,
  EmptyState,
  ToolDescription,
  ToolHeader,
  VirtualizedIssuesList,
} from "./common";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { dataAtom, selectionAtom } from "src/state/jotai";
import { useTranslate } from "src/hooks/use-translate";
import { convertTo, Quantity } from "src/quantity";
import {
  ProximityAnomaly,
  findProximityAnomalies,
} from "src/lib/network-review/proximity-anomalies";
import { useSelection, USelection } from "src/selection";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import { Button } from "src/components/elements";
import { Maybe } from "purify-ts/Maybe";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";

export const ProximityAnomalies = ({ onGoBack }: { onGoBack: () => void }) => {
  const userTracking = useUserTracking();
  const { checkProximityAnomalies, proximityAnomalies } =
    useCheckProximityAnomalies();
  const { distanceInM, localizedDistance, updateDistance } = useDistance();
  const selection = useAtomValue(selectionAtom);
  const { setSelection, isSelected, clearSelection } = useSelection(selection);
  const zoomTo = useZoomTo();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);

  const lastIssuesCount = useRef(0);
  const distanceInputRef = useRef<HTMLDivElement>(null);

  useEffect(
    function recomputeProximityAnomalies() {
      void checkProximityAnomalies(distanceInM);
    },
    [distanceInM, checkProximityAnomalies],
  );

  const selectProximityAnomaly = useCallback(
    (anomaly: ProximityAnomaly | null) => {
      if (!anomaly) {
        setSelectedConnectionId(null);
        clearSelection();
        return;
      }
      const nodeAsset = hydraulicModel.assets.get(anomaly.nodeId);
      const pipeAsset = hydraulicModel.assets.get(anomaly.pipeId);
      if (!nodeAsset || !pipeAsset) {
        setSelectedConnectionId(null);
        return;
      }
      const connectionId = `${anomaly.nodeId}-${anomaly.pipeId}`;
      setSelectedConnectionId(connectionId);
      setSelection(USelection.fromIds([anomaly.nodeId, anomaly.pipeId]));

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
      setSelectedConnectionId(null);
    } else {
      const connectionId = `${selectedAnomaly.nodeId}-${selectedAnomaly.pipeId}`;
      setSelectedConnectionId((prev) =>
        prev === connectionId ? prev : connectionId,
      );
    }
  }, [proximityAnomalies, isSelected]);

  useEffect(() => {
    const issuesCount = proximityAnomalies.length;
    if (lastIssuesCount.current !== issuesCount) {
      lastIssuesCount.current = issuesCount;
      userTracking.capture({
        name: "networkReview.proximityAnomalies.changed",
        count: issuesCount,
      });
    }
  }, [proximityAnomalies, userTracking]);

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

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        onGoBack={onGoBack}
        itemsCount={proximityAnomalies.length}
        checkType={CheckType.proximityAnomalies}
      />
      <DistanceInput
        distance={localizedDistance}
        onChange={updateDistance}
        inputRef={distanceInputRef}
      />
      {proximityAnomalies.length > 0 ? (
        <IssuesList
          issues={proximityAnomalies}
          onClick={selectProximityAnomaly}
          selectedId={selectedConnectionId}
          onGoBack={onGoBack}
        />
      ) : (
        <>
          <ToolDescription checkType={CheckType.proximityAnomalies} />
          <EmptyState checkType={CheckType.proximityAnomalies} />
        </>
      )}
    </div>
  );
};

const DEFAULT_DISTANCE_FT = 1.5;
const DEFAULT_DISTANCE_M = 0.5;

const DistanceInput = ({
  onChange,
  distance,
  inputRef,
}: {
  onChange: (distance: number) => void;
  distance: Quantity;
  inputRef?: React.RefObject<HTMLDivElement>;
}) => {
  const translate = useTranslate();

  const label = `${translate("networkReview.proximityAnomalies.distance")} (${distance.unit})`;

  return (
    <div className="px-1" ref={inputRef}>
      <div className="flex gap-2 flex-auto p-3 items-center flex-wrap">
        <label className="pr-2 text-sm text-gray-500">{label}</label>
        <NumericField
          label={label}
          displayValue={localizeDecimal(distance.value)}
          onChangeValue={onChange}
          styleOptions={{ padding: "sm", textSize: "sm" }}
          tabIndex={0}
        />
      </div>
    </div>
  );
};

const useDistance = () => {
  const {
    hydraulicModel: {
      units: { length: unit },
    },
  } = useAtomValue(dataAtom);
  const [distance, setDistance] = useState<number>(() =>
    unit === "ft" ? DEFAULT_DISTANCE_FT : DEFAULT_DISTANCE_M,
  );
  const distanceInM = useRef<number>(convertTo({ value: distance, unit }, "m"));

  const updateDistance = useCallback(
    (value: number) => {
      setDistance(value);
      distanceInM.current = convertTo({ value, unit }, "m");
    },
    [unit],
  );

  return {
    distanceInM: distanceInM.current,
    localizedDistance: { value: distance, unit },
    updateDistance,
  };
};

const useCheckProximityAnomalies = () => {
  const [proximityAnomalies, setProximityAnomalies] = useState<
    ProximityAnomaly[]
  >([]);
  const { hydraulicModel } = useAtomValue(dataAtom);

  const checkProximityAnomalies = useCallback(
    async (distance: number) => {
      const result = await findProximityAnomalies(hydraulicModel, distance);
      setProximityAnomalies(result);
    },
    [hydraulicModel],
  );

  return { checkProximityAnomalies, proximityAnomalies };
};

const IssuesList = ({
  issues,
  onClick,
  selectedId,
  onGoBack,
}: {
  issues: ProximityAnomaly[];
  onClick: (issue: ProximityAnomaly | null) => void;
  selectedId: string | null;
  onGoBack: () => void;
}) => {
  return (
    <VirtualizedIssuesList
      items={issues}
      selectedId={selectedId}
      onSelect={onClick}
      getItemId={(issue) => `${issue.nodeId}-${issue.pipeId}`}
      renderItem={(anomaly, selectedId, onClick) => (
        <ProximityAnomalyItem
          anomaly={anomaly}
          selectedId={selectedId}
          onClick={onClick}
        />
      )}
      checkType={CheckType.proximityAnomalies}
      onGoBack={onGoBack}
    />
  );
};

const ProximityAnomalyItem = ({
  anomaly,
  onClick,
  selectedId,
}: {
  anomaly: ProximityAnomaly;
  onClick: (anomaly: ProximityAnomaly) => void;
  selectedId: string | null;
}) => {
  const translate = useTranslate();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const connectionId = `${anomaly.nodeId}-${anomaly.pipeId}`;
  const isSelected = selectedId === connectionId;

  const nodeAsset = hydraulicModel.assets.get(anomaly.nodeId);

  if (!nodeAsset) return null;

  const lengthUnit = hydraulicModel.units.length;
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
      role="button"
      aria-label={translate(
        "networkReview.proximityAnomalies.issueLabel",
        nodeAsset.label,
      )}
      aria-checked={isSelected}
      aria-expanded={isSelected ? "true" : "false"}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div className="grid grid-cols-[1fr_auto] gap-x-2 items-center p-1 pr-0 text-sm w-full justify-between">
        <div className="text-sm font-semibold truncate text-left">
          {nodeAsset.label}
        </div>
        <div className="text-xs text-gray-500 min-w-0">
          {distanceFormatted} {lengthUnit}
        </div>
      </div>
    </Button>
  );
};
