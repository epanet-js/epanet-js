import { ChevronLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button, Loading } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { NoIssuesIcon } from "src/icons";

export const enum CheckType {
  connectivityTrace = "connectivityTrace",
  orphanAssets = "orphanAssets",
  proximityAnomalies = "proximityAnomalies",
  crossingPipes = "crossingPipes",
}

export const ToolHeader = ({
  onGoBack,
  itemsCount,
  checkType,
  autoFocus = false,
}: {
  onGoBack: () => void;
  itemsCount: number;
  checkType: CheckType;
  autoFocus?: boolean;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const headerRef = useRef<HTMLDivElement>(null);

  const goBack = useCallback(() => {
    userTracking.capture({
      name: `networkReview.${checkType}.back`,
      count: itemsCount,
    });
    onGoBack();
  }, [onGoBack, userTracking, itemsCount, checkType]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        goBack();
      }
    },
    [goBack],
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
      className="grid grid-cols-[auto_1fr] gap-x-1 items-start w-full border-b border-gray-200 pl-1 py-3"
      tabIndex={autoFocus ? 0 : undefined}
      onKeyDown={autoFocus ? handleKeyDown : undefined}
    >
      <Button
        className="mt-[-.25rem] py-1.5"
        size="xs"
        variant={"quiet"}
        role="button"
        aria-label={translate("back")}
        onClick={goBack}
      >
        <ChevronLeftIcon size={16} />
      </Button>
      <div className="w-full flex-col">
        <p className="text-sm font-bold text-gray-900 dark:text-white">
          {translate(`networkReview.${checkType}.title`)}
        </p>
        <Summary checkType={checkType} count={itemsCount} />
      </div>
    </div>
  );
};

const Summary = ({
  count,
  checkType,
}: {
  count: number;
  checkType: CheckType;
}) => {
  const translate = useTranslate();
  const message = translate(`networkReview.${checkType}.summary`, count);
  return <p className="text-gray-500 text-sm">{message}</p>;
};

export const ToolDescription = ({ checkType }: { checkType: CheckType }) => {
  const translate = useTranslate();
  return (
    <p className="text-sm w-full p-3">
      {translate(`networkReview.${checkType}.description`)}
    </p>
  );
};

export const EmptyState = ({ checkType }: { checkType: CheckType }) => {
  const translate = useTranslate();
  return (
    <div className="flex-grow flex flex-col items-center justify-center px-4 pb-4">
      <div className="text-gray-400">
        <NoIssuesIcon size={96} />
      </div>
      <p className="text-sm text-center py-4 text-gray-600 max-w-48">
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
      <div className="absolute bottom-px inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
        <Loading />
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col items-center justify-center px-4 pb-4">
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

export const VirtualizedIssuesList = <T,>({
  items,
  selectedId,
  onSelect,
  getItemId: getIdFromIssue,
  renderItem,
  checkType,
  estimateSize = 35,
  autoFocus = true,
  onGoBack,
}: {
  items: T[];
  selectedId: string | null;
  onSelect: (item: T | null) => void;
  getItemId: (item: T) => string;
  renderItem: (
    index: number,
    item: T,
    selectedId: string | null,
    onClick: (item: T) => void,
  ) => React.ReactNode;
  checkType: CheckType;
  estimateSize?: number;
  autoFocus?: boolean;
  onGoBack: () => void;
}) => {
  const headerRows = 1;
  const lastKeyboardNavigatedIndexRef = useRef<number | null>(null);
  const lastProcessedSelectedIdRef = useRef<string | null>(null);

  const { listRef, focusList } = useListAutoFocus({
    autoFocus,
    itemsCount: items.length,
  });

  const rowVirtualizer = useVirtualizer({
    count: items.length + headerRows,
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

    const rowIndex = lastKeyboardNavigatedIndexRef.current + headerRows;
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
          const nextPageIndex = Math.min(
            Math.max(endIndex - headerRows, 0),
            items.length - 1,
          );
          onSelect(items[nextPageIndex]);
          lastKeyboardNavigatedIndexRef.current = nextPageIndex;
          lastProcessedSelectedIdRef.current = getIdFromIssue(
            items[nextPageIndex],
          );
          break;
        case "PageUp":
          e.preventDefault();
          const { startIndex } = range;
          const previousPageIndex = Math.max(startIndex - headerRows - 1, 0);
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
    ],
  );

  useEffect(
    function syncIndexWhenSelectedIdChangesExternally() {
      if (
        selectedId !== lastProcessedSelectedIdRef.current &&
        selectedId !== null
      ) {
        const newIndex = items.findIndex(
          (item) => getIdFromIssue(item) === selectedId,
        );
        if (newIndex !== -1) {
          lastKeyboardNavigatedIndexRef.current = newIndex;
          lastProcessedSelectedIdRef.current = selectedId;
        }
      }
      ensureItemIsVisible();
    },
    [selectedId, items, getIdFromIssue, ensureItemIsVisible],
  );

  const rows = rowVirtualizer.getVirtualItems();

  return (
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
        <div
          className="absolute top-0 left-0 w-full"
          style={{
            transform: `translateY(${rows[0]?.start ?? 0}px)`,
          }}
        >
          {rows.map((virtualRow) => {
            if (virtualRow.index === 0) {
              return (
                <div
                  key="description"
                  data-index={virtualRow.index}
                  className="w-full"
                  ref={rowVirtualizer.measureElement}
                  role="listItem"
                >
                  <ToolDescription checkType={checkType} />
                </div>
              );
            }

            const item = items[virtualRow.index - headerRows];
            const itemIndex = virtualRow.index - headerRows;
            const handleClickWithIndex = (clickedIssue: T) =>
              handleItemClick(clickedIssue, itemIndex);

            return (
              <div
                key={getIdFromIssue(item)}
                data-index={virtualRow.index}
                className="w-full px-1"
                ref={rowVirtualizer.measureElement}
                role="listItem"
              >
                {renderItem(
                  virtualRow.index,
                  item,
                  selectedId,
                  handleClickWithIndex,
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
