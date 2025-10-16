import { CheckType, EmptyState, ToolDescription, ToolHeader } from "./common";
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
import { useVirtualizer } from "@tanstack/react-virtual";
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
    (crossing: CrossingPipe) => {
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
  onClick: (issue: CrossingPipe) => void;
  selectedId: string | null;
}) => {
  const headerRows = 1;
  const parentRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: issues.length + headerRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
  });

  useEffect(() => {
    if (selectedId === null) return;

    const rowIndex =
      issues.findIndex(
        (crossing) => `${crossing.pipe1Id}-${crossing.pipe2Id}` === selectedId,
      ) + headerRows;

    const range = rowVirtualizer.range;

    if (!range) return;
    const { startIndex, endIndex } = range;
    if (rowIndex >= startIndex && rowIndex < endIndex) {
      return;
    }

    rowVirtualizer.scrollToIndex(rowIndex, {
      align: "center",
    });
  }, [selectedId, issues, rowVirtualizer]);

  const items = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="flex-auto p-1 overflow-y-auto placemark-scrollbar"
      style={{ contain: "strict" }}
      tabIndex={0}
    >
      <div
        className="w-full relative"
        style={{ height: rowVirtualizer.getTotalSize() }}
      >
        <div
          className="absolute top-0 left-0 w-full"
          style={{
            transform: `translateY(${items[0]?.start ?? 0}px)`,
          }}
        >
          {items.map((virtualRow) => {
            if (virtualRow.index === 0) {
              return (
                <div
                  key="description"
                  data-index={virtualRow.index}
                  className="w-full"
                  ref={rowVirtualizer.measureElement}
                  role="listItem"
                >
                  <ToolDescription checkType={CheckType.crossingPipes} />
                </div>
              );
            }

            const issue = issues[virtualRow.index - headerRows];
            return (
              <div
                key={`${issue.pipe1Id}-${issue.pipe2Id}`}
                data-index={virtualRow.index}
                className="w-full"
                ref={rowVirtualizer.measureElement}
                role="listItem"
              >
                <CrossingPipeItem
                  crossing={issue}
                  selectedId={selectedId}
                  onClick={onClick}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
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
      variant={"quiet"}
      role="button"
      aria-label={translate(
        "networkReview.crossingPipes.issueLabel",
        pipe1Asset.label,
        pipe2Asset.label,
        distanceFormatted,
      )}
      aria-checked={isSelected}
      aria-expanded={isSelected ? "true" : "false"}
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
