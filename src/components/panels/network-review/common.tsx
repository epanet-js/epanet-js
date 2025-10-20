import { ChevronLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "src/components/elements";
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
}: {
  onGoBack: () => void;
  itemsCount: number;
  checkType: CheckType;
}) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();

  const goBack = useCallback(() => {
    userTracking.capture({
      name: `networkReview.${checkType}.back`,
      count: itemsCount,
    });
    onGoBack();
  }, [onGoBack, userTracking, itemsCount, checkType]);

  return (
    <div
      className="grid gap-x-1 items-start w-full border-b-2 border-gray-100 pl-1 py-3"
      style={{
        gridTemplateColumns: "auto 1fr",
      }}
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

export const VirtualizedIssuesList = <T,>({
  issues,
  selectedId,
  onSelect,
  getIdFromIssue,
  renderItem,
  checkType,
  estimateSize = 35,
  autoFocus = true,
}: {
  issues: T[];
  selectedId: string | null;
  onSelect: (issue: T | null) => void;
  getIdFromIssue: (issue: T) => string;
  renderItem: (
    issue: T,
    selectedId: string | null,
    onClick: (issue: T) => void,
  ) => React.ReactNode;
  checkType: CheckType;
  estimateSize?: number;
  autoFocus?: boolean;
}) => {
  const headerRows = 1;
  const listRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  const rowVirtualizer = useVirtualizer({
    count: issues.length + headerRows,
    getScrollElement: () => listRef.current,
    estimateSize: () => estimateSize,
  });

  const handleItemClick = useCallback(
    (issue: T) => {
      onSelect(issue);
      // Focus the list container so keyboard navigation works immediately
      if (listRef.current) {
        listRef.current.focus();
      }
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (issues.length === 0) return;

      const range = rowVirtualizer.range;
      if (!range) return;

      const currentIndex = selectedId
        ? issues.findIndex((issue) => getIdFromIssue(issue) === selectedId)
        : -1;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, issues.length - 1);
          onSelect(issues[nextIndex]);
          break;
        case "ArrowUp":
          e.preventDefault();
          const prevIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
          onSelect(issues[prevIndex]);
          break;
        case "PageDown":
          e.preventDefault();
          const { endIndex } = range;
          const nextPageIndex = Math.min(
            Math.max(endIndex - headerRows, 0),
            issues.length - 1,
          );
          onSelect(issues[nextPageIndex]);
          break;
        case "PageUp":
          e.preventDefault();
          const { startIndex } = range;
          const previousPageIndex = Math.max(startIndex - headerRows - 1, 0);
          onSelect(issues[previousPageIndex]);
          break;
        case "Escape":
          e.preventDefault();
          onSelect(null);
          break;
      }
    },
    [issues, selectedId, onSelect, getIdFromIssue, rowVirtualizer],
  );

  useEffect(
    function autoscrollToSelectedItem() {
      if (selectedId === null) return;

      const rowIndex =
        issues.findIndex((issue) => getIdFromIssue(issue) === selectedId) +
        headerRows;

      const range = rowVirtualizer.range;

      if (!range) return;
      const { startIndex, endIndex } = range;
      if (rowIndex >= startIndex && rowIndex < endIndex) {
        return;
      }

      rowVirtualizer.scrollToIndex(rowIndex, {
        align: "center",
      });
    },
    [selectedId, issues, rowVirtualizer, getIdFromIssue],
  );

  useEffect(
    function autoFocusWhenListIsNotEmpty() {
      if (autoFocus && issues.length > 0 && listRef.current) {
        // Small delay to ensure the DOM is ready
        const timer = setTimeout(() => {
          listRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
      }
    },
    [issues.length, autoFocus],
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

  const items = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={listRef}
      className="group flex-auto p-1 overflow-y-auto placemark-scrollbar"
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
                  <ToolDescription checkType={checkType} />
                </div>
              );
            }

            const issue = issues[virtualRow.index - headerRows];
            return (
              <div
                key={getIdFromIssue(issue)}
                data-index={virtualRow.index}
                className="w-full"
                ref={rowVirtualizer.measureElement}
                role="listItem"
              >
                {renderItem(issue, selectedId, handleItemClick)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
