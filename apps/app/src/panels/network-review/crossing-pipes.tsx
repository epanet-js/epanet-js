import {
  CheckType,
  findCrossingPipes,
  CrossingPipe,
} from "src/lib/network-review";
import clsx from "clsx";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useArchivedItems } from "./use-archived-items";
import { FixCrossingPipesButton } from "./fixes/fix-crossing-pipes-button";
import { useFixCrossingPipes } from "./fixes/use-fix-crossing-pipes";
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
import { useAtomValue } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { useUserTracking } from "src/infra/user-tracking";
import { useSelection, USelection } from "src/selection";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { Button } from "src/components/elements";
import { Pipe } from "src/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { localizeDecimal } from "@epanet-js/i18n";
import { Maybe } from "purify-ts/Maybe";

export const CrossingPipes = ({ onGoBack }: { onGoBack: () => void }) => {
  const userTracking = useUserTracking();
  const { checkCrossingPipes, crossingPipes, isLoading, isReady } =
    useCheckCrossingPipes();
  const selection = useAtomValue(selectionAtom);
  const { setSelection, isSelected, clearSelection } = useSelection(selection);
  const zoomTo = useZoomTo();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
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
      setSelection(
        USelection.fromAssetIds([crossing.pipe1Id, crossing.pipe2Id]),
      );
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

  const isFixCrossingPipesOn = useFeatureFlag("FLAG_FIX_CROSSING_PIPES");
  const archiving = useArchivedItems(CheckType.crossingPipes);
  const { isArchived } = archiving;

  const activeCount = useMemo(
    () =>
      isFixCrossingPipesOn
        ? crossingPipes.filter((item) => !isArchived(getCrossingId(item)))
            .length
        : crossingPipes.length,
    [crossingPipes, isArchived, isFixCrossingPipesOn],
  );

  const headerProps = useCheckHeader(
    CheckType.crossingPipes,
    activeCount,
    onGoBack,
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <ToolHeader
        {...headerProps}
        autoFocus={crossingPipes.length === 0 && !isLoading}
      />
      <div className="relative grow flex flex-col">
        {isReady ? (
          <>
            {crossingPipes.length > 0 ? (
              <CrossingPipesList
                crossingPipes={crossingPipes}
                onSelect={selectCrossingPipes}
                selectedCrossingPipes={selectedCrossingId}
                onGoBack={onGoBack}
                archiving={isFixCrossingPipesOn ? archiving : undefined}
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

const CrossingPipesList = ({
  crossingPipes,
  onSelect,
  selectedCrossingPipes,
  onGoBack,
  archiving,
}: {
  crossingPipes: CrossingPipe[];
  onSelect: (issue: CrossingPipe | null) => void;
  selectedCrossingPipes: string | null;
  onGoBack: () => void;
  archiving?: Archiving<string>;
}) => {
  const isFixCrossingPipesOn = useFeatureFlag("FLAG_FIX_CROSSING_PIPES");
  const { fix } = useFixCrossingPipes();

  const fixCrossing = useCallback(
    (crossingId: string) => {
      const crossing = crossingPipes.find(
        (candidate) => getCrossingId(candidate) === crossingId,
      );
      if (!crossing) return;

      fix(crossing);
    },
    [crossingPipes, fix],
  );

  return (
    <VirtualizedIssuesList
      items={crossingPipes}
      selectedItemId={selectedCrossingPipes}
      onSelect={onSelect}
      getItemId={getCrossingId}
      renderItem={(_index, crossing, selectedId, onClick, isArchived) => (
        <CrossingPipeItem
          crossing={crossing}
          selectedId={selectedId}
          onClick={onClick}
          isArchived={isArchived}
        />
      )}
      renderItemAction={
        isFixCrossingPipesOn
          ? (crossing) => (
              <FixCrossingPipesButton
                onFix={() => fixCrossing(getCrossingId(crossing))}
              />
            )
          : undefined
      }
      onItemAction={isFixCrossingPipesOn ? fixCrossing : undefined}
      archiving={archiving}
      checkType={CheckType.crossingPipes}
      onGoBack={onGoBack}
    />
  );
};

const CrossingPipeItem = ({
  crossing,
  onClick,
  selectedId,
  isArchived = false,
}: {
  crossing: CrossingPipe;
  onClick: (crossing: CrossingPipe) => void;
  selectedId: string | null;
  isArchived?: boolean;
}) => {
  const translate = useTranslate();
  const isFixCrossingPipesOn = useFeatureFlag("FLAG_FIX_CROSSING_PIPES");
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
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

  const diameter1Formatted =
    pipe1.diameter === null ? "—" : localizeDecimal(pipe1.diameter);
  const diameter2Formatted =
    pipe2.diameter === null ? "—" : localizeDecimal(pipe2.diameter);

  const labelClassName = clsx(
    "min-w-0 truncate text-left",
    isArchived && "text-subtle",
  );

  const diameterClassName = clsx(
    "whitespace-nowrap text-subtle",
    isFixCrossingPipesOn ? "text-left" : "text-right",
  );

  return (
    <Button
      onClick={() => onClick(crossing)}
      onMouseDown={(e) => e.preventDefault()}
      variant={"quiet/list"}
      aria-label={translate(
        "networkReview.crossingPipes.issueLabel",
        pipe1Asset.label,
        pipe2Asset.label,
      )}
      aria-selected={isSelected}
      size="xxs"
      tabIndex={-1}
      className="group w-full hover:bg-transparent dark:hover:bg-transparent aria-selected:bg-transparent! aria-selected:hover:bg-transparent!"
    >
      <div
        className={clsx(
          "grid w-full items-start py-1 px-2 text-size-base",
          isFixCrossingPipesOn
            ? "grid-cols-[minmax(0,auto)_auto] gap-x-2 justify-start"
            : "grid-cols-[1fr_auto]",
        )}
      >
        <div className={labelClassName}>{pipe1Asset.label}</div>
        <span className={diameterClassName}>⌀ {diameter1Formatted}</span>
        <div className={labelClassName}>{pipe2Asset.label}</div>
        <span className={diameterClassName}>⌀ {diameter2Formatted}</span>
      </div>
    </Button>
  );
};

const deferToAllowRender = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

const useCheckCrossingPipes = () => {
  const [crossingPipes, setCrossingPipes] = useState<CrossingPipe[]>([]);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { startLoading, finishLoading, isLoading } = useLoadingStatus();
  const isReady = useRef(false);

  const checkCrossingPipes = useCallback(
    async (signal?: AbortSignal) => {
      startLoading();
      await deferToAllowRender();

      if (signal?.aborted) {
        return;
      }

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
