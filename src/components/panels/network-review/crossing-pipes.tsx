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
import { useUserTracking } from "src/infra/user-tracking";
import {
  findCrossingPipes,
  CrossingPipe,
} from "src/lib/network-review/crossing-pipes";
import { useSelection, USelection } from "src/selection";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { Button } from "src/components/elements";
import { Pipe } from "src/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { convertTo } from "src/quantity";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Maybe } from "purify-ts/Maybe";

export const CrossingPipes = ({ onGoBack }: { onGoBack: () => void }) => {
  const userTracking = useUserTracking();
  const { checkCrossingPipes, crossingPipes } = useCheckCrossingPipes();
  const selection = useAtomValue(selectionAtom);
  const { setSelection, isSelected } = useSelection(selection);
  const zoomTo = useZoomTo();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [selectedCrossingId, setSelectedCrossingId] = useState<string | null>(
    null,
  );

  const lastIssuesCount = useRef(0);

  useEffect(
    function recomputeCrossingPipes() {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      checkCrossingPipes();
    },
    [checkCrossingPipes],
  );

  useEffect(() => {
    const issuesCount = crossingPipes.length;
    if (lastIssuesCount.current !== issuesCount) {
      lastIssuesCount.current = issuesCount;
      userTracking.capture({
        name: "networkReview.crossingPipes.changed",
        count: issuesCount,
      });
    }
  }, [crossingPipes, userTracking]);

  const selectCrossingPipes = useCallback(
    (crossing: CrossingPipe | null) => {
      if (!crossing) {
        setSelectedCrossingId(null);
        return;
      }

      const pipe1Asset = hydraulicModel.assets.get(crossing.pipe1Id);
      const pipe2Asset = hydraulicModel.assets.get(crossing.pipe2Id);
      if (!pipe1Asset || !pipe2Asset) {
        setSelectedCrossingId(null);
        return;
      }
      const crossingId = `${crossing.pipe1Id}-${crossing.pipe2Id}`;
      setSelectedCrossingId(crossingId);
      setSelection(USelection.fromIds([crossing.pipe1Id, crossing.pipe2Id]));
      const [lon, lat] = crossing.intersectionPoint;
      zoomTo(Maybe.of([lon, lat, lon, lat]));
    },
    [hydraulicModel, setSelection, zoomTo],
  );

  useEffect(() => {
    let selectedCrossing = crossingPipes.find(
      (crossing) =>
        isSelected(crossing.pipe1Id) && isSelected(crossing.pipe2Id),
    );

    if (!selectedCrossing) {
      selectedCrossing = crossingPipes.find(
        (crossing) =>
          isSelected(crossing.pipe1Id) || isSelected(crossing.pipe2Id),
      );
    }

    if (!selectedCrossing) {
      setSelectedCrossingId(null);
    } else {
      const crossingId = `${selectedCrossing.pipe1Id}-${selectedCrossing.pipe2Id}`;
      setSelectedCrossingId((prev) =>
        prev === crossingId ? prev : crossingId,
      );
    }
  }, [crossingPipes, isSelected]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        onGoBack={onGoBack}
        itemsCount={crossingPipes.length}
        checkType={CheckType.crossingPipes}
      />
      {crossingPipes.length > 0 ? (
        <IssuesList
          issues={crossingPipes}
          onClick={selectCrossingPipes}
          selectedId={selectedCrossingId}
        />
      ) : (
        <>
          <ToolDescription checkType={CheckType.crossingPipes} />
          <EmptyState checkType={CheckType.crossingPipes} />
        </>
      )}
    </div>
  );
};

const IssuesList = ({
  issues,
  onClick,
  selectedId,
}: {
  issues: CrossingPipe[];
  onClick: (issue: CrossingPipe | null) => void;
  selectedId: string | null;
}) => {
  return (
    <VirtualizedIssuesList
      issues={issues}
      selectedId={selectedId}
      onSelect={onClick}
      getIdFromIssue={(issue) => `${issue.pipe1Id}-${issue.pipe2Id}`}
      renderItem={(crossing, selectedId, onClick) => (
        <CrossingPipeItem
          crossing={crossing}
          selectedId={selectedId}
          onClick={onClick}
        />
      )}
      checkType={CheckType.crossingPipes}
    />
  );
};

const CrossingPipeItem = ({
  crossing,
  onClick,
  selectedId,
}: {
  crossing: CrossingPipe;
  onClick: (crossing: CrossingPipe) => void;
  selectedId: string | null;
}) => {
  const translate = useTranslate();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const crossingId = `${crossing.pipe1Id}-${crossing.pipe2Id}`;
  const isSelected = selectedId === crossingId;

  const pipe1Asset = hydraulicModel.assets.get(crossing.pipe1Id);
  const pipe2Asset = hydraulicModel.assets.get(crossing.pipe2Id);

  if (
    !pipe1Asset ||
    pipe1Asset.type !== "pipe" ||
    !pipe2Asset ||
    pipe2Asset.type !== "pipe"
  )
    return null;

  const pipe1 = pipe1Asset as Pipe;
  const pipe2 = pipe2Asset as Pipe;
  const lengthUnit = hydraulicModel.units.length;
  const distanceInModelUnits = convertTo(
    { value: crossing.distanceToNearestJunction, unit: "m" },
    lengthUnit,
  );
  const distanceFormatted = localizeDecimal(distanceInModelUnits, {
    decimals: 2,
  });
  const diameter1Formatted = localizeDecimal(pipe1.diameter);
  const diameter2Formatted = localizeDecimal(pipe2.diameter);

  return (
    <Button
      onClick={() => onClick(crossing)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      role="button"
      aria-label={translate(
        "networkReview.crossingPipes.issueLabel",
        pipe1Asset.label,
        pipe2Asset.label,
        distanceFormatted,
      )}
      aria-checked={isSelected}
      aria-expanded={isSelected ? "true" : "false"}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div
        className="grid gap-x-2 items-start p-1 pr-0 text-sm w-full text-left"
        style={{
          gridTemplateColumns: "1fr auto",
        }}
      >
        <div className="text-sm flex items-center gap-1 min-w-0 truncate">
          {pipe1Asset.label}
        </div>
        <span className="flex-shrink-0 whitespace-nowrap text-gray-500">
          ⌀ {diameter1Formatted}
        </span>
        <div className="text-sm flex items-center gap-1 min-w-0 truncate">
          {pipe2Asset.label}
        </div>
        <span className="flex-shrink-0 whitespace-nowrap text-gray-500">
          ⌀ {diameter2Formatted}
        </span>
      </div>
    </Button>
  );
};

const useCheckCrossingPipes = () => {
  const [crossingPipes, setCrossingPipes] = useState<CrossingPipe[]>([]);
  const { hydraulicModel } = useAtomValue(dataAtom);

  const checkCrossingPipes = useCallback(async () => {
    const result = await findCrossingPipes(hydraulicModel, 0.5);
    setCrossingPipes(result);
  }, [hydraulicModel]);

  return { checkCrossingPipes, crossingPipes };
};
