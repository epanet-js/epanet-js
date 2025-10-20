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
import { PipeIcon } from "src/icons";
import { Pipe } from "src/hydraulic-model";

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
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      checkProximityAnomalies(distanceInM);
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
      zoomTo([nodeAsset]);
    },
    [hydraulicModel, setSelection, zoomTo],
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

  // Auto-focus the distance input when there are no results
  useEffect(() => {
    if (proximityAnomalies.length === 0 && distanceInputRef.current) {
      const timer = setTimeout(() => {
        distanceInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [proximityAnomalies.length]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        onGoBack={onGoBack}
        itemsCount={proximityAnomalies.length}
        checkType={CheckType.proximityAnomalies}
        autoFocus={proximityAnomalies.length === 0}
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
    <div className="px-1" ref={inputRef} tabIndex={-1}>
      <div className="flex gap-2 flex-row p-3 items-center">
        <label className="pr-2 text-sm flex-1">{label}</label>
        <div className="flex-1">
          <NumericField
            label={label}
            displayValue={localizeDecimal(distance.value)}
            onChangeValue={onChange}
            styleOptions={{ padding: "sm", textSize: "sm" }}
          />
        </div>
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
      issues={issues}
      selectedId={selectedId}
      onSelect={onClick}
      getIdFromIssue={(issue) => `${issue.nodeId}-${issue.pipeId}`}
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
  const pipeAsset = hydraulicModel.assets.get(anomaly.pipeId);

  if (!nodeAsset || !pipeAsset || pipeAsset.type !== "pipe") return null;

  const pipe = pipeAsset as Pipe;
  const lengthUnit = hydraulicModel.units.length;
  const distanceInModelUnits = convertTo(
    { value: anomaly.distance, unit: "m" },
    lengthUnit,
  );
  const distanceFormatted = localizeDecimal(distanceInModelUnits, {
    decimals: 2,
  });
  const diameterFormatted = localizeDecimal(pipe.diameter);

  return (
    <Button
      onClick={() => onClick(anomaly)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      role="button"
      aria-label={translate(
        "networkReview.proximityAnomalies.issueLabel",
        nodeAsset.label,
        pipeAsset.label,
        distanceFormatted,
      )}
      aria-checked={isSelected}
      aria-expanded={isSelected ? "true" : "false"}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div
        className="grid gap-x-2 items-start p-1 pr-0 text-sm w-full"
        style={{
          gridTemplateColumns: "1fr auto",
        }}
      >
        <div className="text-left min-w-0">
          <div className="text-sm font-semibold truncate">
            {nodeAsset.label}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1 min-w-0">
            <PipeIcon size={12} className="flex-shrink-0" />
            <span className="truncate">{pipeAsset.label}</span>
            <span className="flex-shrink-0 whitespace-nowrap">
              ⌀ {diameterFormatted}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-500 pt-[.125rem] flex-shrink-0 whitespace-nowrap">
          {distanceFormatted} {lengthUnit}
        </div>
      </div>
    </Button>
  );
};
