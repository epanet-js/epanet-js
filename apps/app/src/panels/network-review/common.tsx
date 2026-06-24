import { ChevronLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button, Loading } from "src/components/elements";
import { Action, ActionButton } from "src/components/action-button";
import { useTranslate } from "src/hooks/use-translate";
import { useZoom } from "src/hooks/use-zoom";
import { useUserTracking } from "src/infra/user-tracking";
import { NoIssuesIcon } from "src/icons";

export const enum CheckType {
  connectivityTrace = "connectivityTrace",
  orphanAssets = "orphanAssets",
  proximityAnomalies = "proximityAnomalies",
  crossingPipes = "crossingPipes",
  modelAttributesValidation = "modelAttributesValidation",
}

export const ToolHeader = ({
  onGoBack,
  title,
  summary,
  actions,
  autoFocus = false,
}: {
  onGoBack: () => void;
  title: string;
  summary?: string;
  actions?: Action[];
  autoFocus?: boolean;
}) => {
  const translate = useTranslate();
  const headerRef = useRef<HTMLDivElement>(null);

  const applicableActions = (actions ?? []).filter(
    (action) => action.applicable,
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onGoBack();
      }
    },
    [onGoBack],
  );

  useEffect(() => {
    if (autoFocus && headerRef.current) {
      const timer = setTimeout(() => {
        headerRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  return (
    <div
      ref={headerRef}
      className="grid grid-cols-[auto_1fr] gap-x-1 items-start w-full border-b pl-1 py-3"
      tabIndex={autoFocus ? 0 : undefined}
      onKeyDown={autoFocus ? handleKeyDown : undefined}
    >
      <Button
        className="h-8 w-4 justify-center -my-1.5"
        size="xxs"
        variant={"quiet"}
        aria-label={translate("back")}
        onClick={onGoBack}
      >
        <ChevronLeftIcon size={16} />
      </Button>
      <div className="w-full pr-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-size-base font-bold text-default">{title}</p>
          {applicableActions.length > 0 && (
            <div className="flex gap-1 -my-1.5">
              {applicableActions.map((action, i) => (
                <ActionButton key={i} action={action} />
              ))}
            </div>
          )}
        </div>
        {summary !== undefined && (
          <p className="text-subtle text-size-base">{summary}</p>
        )}
      </div>
    </div>
  );
};

// Network-review-specific bridge: derives the ToolHeader props from a check
// type and owns the "back" tracking, keeping ToolHeader a generic component.
export const useCheckHeader = (
  checkType: CheckType,
  itemsCount: number,
  onGoBack: () => void,
) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();

  const goBack = useCallback(() => {
    userTracking.capture({
      name: `networkReview.${checkType}.back`,
      count: itemsCount,
    });
    onGoBack();
  }, [checkType, itemsCount, onGoBack, userTracking]);

  return {
    title: translate(`networkReview.${checkType}.title`),
    summary: translate(`networkReview.${checkType}.summary`, itemsCount),
    onGoBack: goBack,
  };
};

export const ToolDescription = ({ checkType }: { checkType: CheckType }) => {
  const translate = useTranslate();
  return (
    <p className="text-size-base w-full p-3">
      {translate(`networkReview.${checkType}.description`)}
    </p>
  );
};

export const EmptyState = ({ checkType }: { checkType: CheckType }) => {
  const translate = useTranslate();
  return (
    <div className="grow flex flex-col items-center justify-center px-4 pb-4">
      <div className="text-subtle">
        <NoIssuesIcon size={96} />
      </div>
      <p className="text-size-base text-center py-4 text-subtle max-w-48">
        {translate(`networkReview.${checkType}.emptyMessage`)}
      </p>
    </div>
  );
};

export const useLoadingStatus = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const startLoading = useCallback(() => {
    setIsLoading(true);
  }, []);
  const finishLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  return { startLoading, finishLoading, isLoading };
};

export const LoadingState = ({ overlay = false }: { overlay?: boolean }) => {
  if (overlay) {
    return (
      <div className="absolute bottom-px inset-0 flex flex-col items-center justify-center bg-base/80/80 backdrop-blur-xs z-10">
        <Loading />
      </div>
    );
  }

  return (
    <div className="grow flex flex-col items-center justify-center px-4 pb-4">
      <Loading />
    </div>
  );
};

const useListAutoFocus = (options: {
  autoFocus: boolean;
  itemsCount: number;
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const { autoFocus, itemsCount: issuesCount } = options;

  const focusList = useCallback(() => {
    listRef.current?.focus();
  }, []);

  useEffect(
    function autoFocusWhenListIsNotEmpty() {
      if (autoFocus && issuesCount > 0 && listRef.current) {
        const timer = setTimeout(() => {
          listRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
      }
    },
    [issuesCount, autoFocus],
  );

  useEffect(function keepFocusAfterScrolling() {
    const element = listRef.current;
    if (!element) return;

    const handleScroll = () => {
      isScrollingRef.current = true;
    };

    const handleScrollEnd = () => {
      if (isScrollingRef.current && document.activeElement !== element) {
        element.focus();
      }
      isScrollingRef.current = false;
    };

    element.addEventListener("scroll", handleScroll);
    element.addEventListener("scrollend", handleScrollEnd);

    // Fallback for browsers that don't support scrollend
    let scrollTimeout: NodeJS.Timeout;
    const handleScrollFallback = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        handleScrollEnd();
      }, 150);
    };

    element.addEventListener("scroll", handleScrollFallback);

    return () => {
      element.removeEventListener("scroll", handleScroll);
      element.removeEventListener("scrollend", handleScrollEnd);
      element.removeEventListener("scroll", handleScrollFallback);
      clearTimeout(scrollTimeout);
    };
  }, []);

  return { listRef, focusList };
};

export const VirtualizedIssuesList = <T, I>({
  items,
  selectedItemId,
  onSelect,
  getItemId: getIdFromIssue,
  renderItem,
  checkType,
  estimateSize = 35,
  autoFocus = true,
  showDescription = true,
  onGoBack,
}: {
  items: T[];
  selectedItemId: I | null;
  onSelect: (item: T | null) => void;
  getItemId: (item: T) => I;
  renderItem: (
    index: number,
    item: T,
    selectedId: I | null,
    onClick: (item: T) => void,
  ) => React.ReactNode;
  checkType: CheckType;
  estimateSize?: number;
  autoFocus?: boolean;
  showDescription?: boolean;
  onGoBack: () => void;
}) => {
  const lastKeyboardNavigatedIndexRef = useRef<number | null>(null);
  const lastProcessedSelectedIdRef = useRef<I | null>(null);

  const { zoomIn, zoomOut } = useZoom();

  const { listRef, focusList } = useListAutoFocus({
    autoFocus,
    itemsCount: items.length,
  });

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => estimateSize,
  });

  const handleItemClick = useCallback(
    (item: T, index: number) => {
      lastKeyboardNavigatedIndexRef.current = index;
      lastProcessedSelectedIdRef.current = getIdFromIssue(item);

      onSelect(item);
      focusList();
    },
    [onSelect, getIdFromIssue, focusList],
  );

  const ensureItemIsVisible = useCallback(() => {
    if (lastKeyboardNavigatedIndexRef.current === null) return;

    const rowIndex = lastKeyboardNavigatedIndexRef.current;
    const range = rowVirtualizer.range;

    if (!range) return;
    const { startIndex, endIndex } = range;
    if (rowIndex >= startIndex && rowIndex < endIndex) {
      return;
    }

    rowVirtualizer.scrollToIndex(rowIndex, {
      align: "center",
    });
  }, [rowVirtualizer]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (items.length === 0) return;

      const range = rowVirtualizer.range;
      if (!range) return;

      const currentIndex = lastKeyboardNavigatedIndexRef.current ?? -1;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, items.length - 1);
          onSelect(items[nextIndex]);
          lastKeyboardNavigatedIndexRef.current = nextIndex;
          lastProcessedSelectedIdRef.current = getIdFromIssue(items[nextIndex]);
          break;
        case "ArrowUp":
          e.preventDefault();
          const prevIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
          onSelect(items[prevIndex]);
          lastKeyboardNavigatedIndexRef.current = prevIndex;
          lastProcessedSelectedIdRef.current = getIdFromIssue(items[prevIndex]);
          break;
        case "PageDown":
          e.preventDefault();
          const { endIndex } = range;
          const nextPageIndex = Math.min(endIndex, items.length - 1);
          onSelect(items[nextPageIndex]);
          lastKeyboardNavigatedIndexRef.current = nextPageIndex;
          lastProcessedSelectedIdRef.current = getIdFromIssue(
            items[nextPageIndex],
          );
          break;
        case "PageUp":
          e.preventDefault();
          const { startIndex } = range;
          const previousPageIndex = Math.max(startIndex - 1, 0);
          onSelect(items[previousPageIndex]);
          lastKeyboardNavigatedIndexRef.current = previousPageIndex;
          lastProcessedSelectedIdRef.current = getIdFromIssue(
            items[previousPageIndex],
          );
          break;
        case "Home":
          e.preventDefault();
          const firstIndex = 0;
          onSelect(items[firstIndex]);
          lastKeyboardNavigatedIndexRef.current = firstIndex;
          lastProcessedSelectedIdRef.current = getIdFromIssue(
            items[firstIndex],
          );
          break;
        case "End":
          e.preventDefault();
          const lastIndex = items.length - 1;
          onSelect(items[lastIndex]);
          lastKeyboardNavigatedIndexRef.current = lastIndex;
          lastProcessedSelectedIdRef.current = getIdFromIssue(items[lastIndex]);
          break;
        case "Escape":
          e.preventDefault();
          if (lastKeyboardNavigatedIndexRef.current !== null) {
            lastKeyboardNavigatedIndexRef.current = null;
            lastProcessedSelectedIdRef.current = null;
            onSelect(null);
          } else if (onGoBack) {
            onGoBack();
          }
          break;
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "-":
        case "_":
          e.preventDefault();
          zoomOut();
          break;
      }

      ensureItemIsVisible();
    },
    [
      items,
      rowVirtualizer.range,
      ensureItemIsVisible,
      onSelect,
      getIdFromIssue,
      onGoBack,
      zoomIn,
      zoomOut,
    ],
  );

  useEffect(
    function syncIndexWhenSelectedIdChangesExternally() {
      if (
        selectedItemId !== lastProcessedSelectedIdRef.current &&
        selectedItemId !== null
      ) {
        const newIndex = items.findIndex(
          (item) => getIdFromIssue(item) === selectedItemId,
        );
        if (newIndex !== -1) {
          lastKeyboardNavigatedIndexRef.current = newIndex;
          lastProcessedSelectedIdRef.current = selectedItemId;
        }
      }
      ensureItemIsVisible();
    },
    [selectedItemId, items, getIdFromIssue, ensureItemIsVisible],
  );

  const rows = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex-auto flex flex-col min-h-0">
      {showDescription && <ToolDescription checkType={checkType} />}
      <div
        ref={listRef}
        className="group flex-auto pb-1 overflow-y-auto placemark-scrollbar"
        style={{ contain: "strict" }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div
          className="w-full relative"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          <ul
            role="list"
            className="absolute top-0 left-0 w-full"
            style={{
              transform: `translateY(${rows[0]?.start ?? 0}px)`,
            }}
          >
            {rows.map((virtualRow) => {
              const item = items[virtualRow.index];
              const itemIndex = virtualRow.index;
              const handleClickWithIndex = (clickedIssue: T) =>
                handleItemClick(clickedIssue, itemIndex);

              return (
                <li
                  key={String(getIdFromIssue(item))}
                  data-index={virtualRow.index}
                  className="w-full px-1"
                  ref={rowVirtualizer.measureElement}
                >
                  {renderItem(
                    itemIndex,
                    item,
                    selectedItemId,
                    handleClickWithIndex,
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};
