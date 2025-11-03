import {
  CheckType,
  EmptyState,
  LoadingState,
  ToolDescription,
  ToolHeader,
  useLoadingStatus,
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
import { localizeDecimal } from "src/infra/i18n/numbers";
import { Maybe } from "purify-ts/Maybe";

export const CrossingPipes = ({ onGoBack }: { onGoBack: () => void }) => {
  const userTracking = useUserTracking();
  const { checkCrossingPipes, crossingPipes, isLoading, isReady } =
    useCheckCrossingPipes();
  const selection = useAtomValue(selectionAtom);
  const { setSelection, isSelected, clearSelection } = useSelection(selection);
  const zoomTo = useZoomTo();
  const { hydraulicModel } = useAtomValue(dataAtom);
  const [selectedCrossingId, setSelectedCrossingId] = useState<string | null>(
    null,
  );

  const lastIssuesCount = useRef(0);

  useEffect(
    function recomputeCrossingPipes() {
      const abortController = new AbortController();
      void checkCrossingPipes(abortController.signal);
      return () => {
        abortController.abort();
      };
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
        clearSelection();
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
    [clearSelection, hydraulicModel.assets, setSelection, zoomTo],
  );

  useEffect(() => {
    const candidateCrossings = crossingPipes
      .filter(
        (crossing) =>
          isSelected(crossing.pipe1Id) || isSelected(crossing.pipe2Id),
      )
      .sort((a, b) => {
        if (isSelected(a.pipe1Id) && isSelected(a.pipe2Id)) return -1;
        if (isSelected(b.pipe1Id) && isSelected(b.pipe2Id)) return 1;
        if (isSelected(a.pipe1Id)) return -1;
        if (isSelected(b.pipe1Id)) return 1;
        return -1;
      });

    if (!candidateCrossings.length) {
      setSelectedCrossingId(null);
    } else {
      const crossingId = getCrossingId(candidateCrossings[0]);
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
        autoFocus={crossingPipes.length === 0 && !isLoading}
      />
      <div className="relative flex-grow flex flex-col">
        {isReady ? (
          <>
            {crossingPipes.length > 0 ? (
              <IssuesList
                issues={crossingPipes}
                onClick={selectCrossingPipes}
                selectedId={selectedCrossingId}
                onGoBack={onGoBack}
              />
            ) : (
              <>
                <ToolDescription checkType={CheckType.crossingPipes} />
                <EmptyState checkType={CheckType.crossingPipes} />
              </>
            )}
            {isLoading && <LoadingState overlay />}
          </>
        ) : (
          <>
            <ToolDescription checkType={CheckType.crossingPipes} />
            <LoadingState />
          </>
        )}
      </div>
    </div>
  );
};

const IssuesList = ({
  issues,
  onClick,
  selectedId,
  onGoBack,
}: {
  issues: CrossingPipe[];
  onClick: (issue: CrossingPipe | null) => void;
  selectedId: string | null;
  onGoBack: () => void;
}) => {
  return (
    <VirtualizedIssuesList
      items={issues}
      selectedId={selectedId}
      onSelect={onClick}
      getItemId={getCrossingId}
      renderItem={(_index, crossing, selectedId, onClick) => (
        <CrossingPipeItem
          crossing={crossing}
          selectedId={selectedId}
          onClick={onClick}
        />
      )}
      checkType={CheckType.crossingPipes}
      onGoBack={onGoBack}
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
  selectedId: string | number | null;
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
      )}
      aria-checked={isSelected}
      aria-expanded={isSelected ? "true" : "false"}
      aria-selected={isSelected}
      tabIndex={-1}
      className="group w-full"
    >
      <div className="grid grid-cols-[1fr_auto] w-full items-start">
        <div className="min-w-0 truncate text-left">{pipe1Asset.label}</div>
        <span className="whitespace-nowrap text-gray-500 text-right">
          ⌀ {diameter1Formatted}
        </span>
        <div className="min-w-0 truncate text-left">{pipe2Asset.label}</div>
        <span className="whitespace-nowrap text-gray-500 text-right">
          ⌀ {diameter2Formatted}
        </span>
      </div>
    </Button>
  );
};

const deferToAllowRender = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const useCheckCrossingPipes = () => {
  const [crossingPipes, setCrossingPipes] = useState<CrossingPipe[]>([]);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const { startLoading, finishLoading, isLoading } = useLoadingStatus();
  const isReady = useRef(false);

  const checkCrossingPipes = useCallback(
    async (signal?: AbortSignal) => {
      startLoading();
      await deferToAllowRender();

      try {
        const result = await findCrossingPipes(
          hydraulicModel,
          0.0000045,
          "array",
          signal,
        );

        if (!signal?.aborted) {
          setCrossingPipes(result);
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
    checkCrossingPipes,
    crossingPipes,
    isLoading,
    isReady: isReady.current,
  };
};

const getCrossingId = (crossing: CrossingPipe) =>
  `${crossing.pipe1Id}-${crossing.pipe2Id}`;
