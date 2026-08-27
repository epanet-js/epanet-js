import clsx from "clsx";
import { ChevronLeftIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "src/components/elements";
import { RingSpinner } from "src/components/ring-spinner";
import { Action, ActionButton } from "src/components/action-button";
import { useTranslate } from "src/hooks/use-translate";
import { useZoom } from "src/hooks/use-zoom";
import { useUserTracking } from "src/infra/user-tracking";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  IgnoreIcon,
  NoIssuesIcon,
  UndoIcon,
} from "src/icons";
import { CheckType } from "src/lib/network-review";
import { FixButton } from "./fixes/fix-button";

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
        <RingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="grow flex flex-col items-center justify-center px-4 pb-4">
      <RingSpinner size="lg" />
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

export type Ignoring<I> = {
  isIgnored: (itemId: I) => boolean;
  onIgnore: (itemId: I) => void;
  onRestore: (itemId: I) => void;
};

type ListRow<T> =
  | { kind: "item"; item: T; itemIndex: number; isIgnored: boolean }
  | { kind: "ignoredHeader"; count: number };

// Ignored rows are dropped from the array entirely while the section is closed,
// so every arrow/Page/Home/End calculation skips them without knowing they exist.
const buildListRows = <T, I>(
  items: T[],
  getItemId: (item: T) => I,
  ignoring: Ignoring<I> | undefined,
  isSectionOpen: boolean,
): ListRow<T>[] => {
  if (!ignoring) {
    return items.map((item, itemIndex) => ({
      kind: "item",
      item,
      itemIndex,
      isIgnored: false,
    }));
  }

  const active: ListRow<T>[] = [];
  const ignored: ListRow<T>[] = [];

  items.forEach((item, itemIndex) => {
    const row = {
      kind: "item",
      item,
      itemIndex,
      isIgnored: ignoring.isIgnored(getItemId(item)),
    } as const;

    (row.isIgnored ? ignored : active).push(row);
  });

  if (ignored.length === 0) return active;

  return [
    ...active,
    { kind: "ignoredHeader", count: ignored.length },
    ...(isSectionOpen ? ignored : []),
  ];
};

const IgnoredSectionHeader = ({
  count,
  isOpen,
  isFocused,
  onToggle,
}: {
  count: number;
  isOpen: boolean;
  isFocused: boolean;
  onToggle: () => void;
}) => {
  const translate = useTranslate();

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-expanded={isOpen}
      data-section-type="ignored"
      onClick={onToggle}
      onMouseDown={(e) => e.preventDefault()}
      className={clsx(
        "w-full flex items-center gap-1 h-8 px-1 rounded-sm",
        "text-size-base font-semibold text-default",
        isFocused ? "bg-accent-tint" : "hover:bg-base-hover",
      )}
    >
      <IgnoreIcon />
      <span className="truncate">{translate("ignored")}</span>
      <span className="shrink-0">({count})</span>
      <div className="flex-1 border-b ml-2" />
      {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
    </button>
  );
};

export const VirtualizedIssuesList = <T, I>({
  items,
  selectedItemId,
  onSelect,
  getItemId: getIdFromIssue,
  renderItem,
  renderItemAction,
  onItemAction,
  ignoring,
  checkType,
  estimateSize = 32,
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
    isIgnored: boolean,
  ) => React.ReactNode;
  renderItemAction?: (item: T, isSelected: boolean) => React.ReactNode;
  onItemAction?: (itemId: I) => void;
  ignoring?: Ignoring<I>;
  checkType: CheckType;
  estimateSize?: number;
  autoFocus?: boolean;
  showDescription?: boolean;
  onGoBack: () => void;
}) => {
  const translate = useTranslate();
  const lastKeyboardNavigatedIndexRef = useRef<number | null>(null);
  const lastProcessedSelectedIdRef = useRef<I | null>(null);
  const [isHeaderFocused, setHeaderFocused] = useState(false);
  const [isIgnoredSectionOpen, setIgnoredSectionOpen] = useState(false);

  const { zoomIn, zoomOut } = useZoom();

  const { listRef, focusList } = useListAutoFocus({
    autoFocus,
    itemsCount: items.length,
  });

  const listRows = useMemo(
    () => buildListRows(items, getIdFromIssue, ignoring, isIgnoredSectionOpen),
    [items, getIdFromIssue, ignoring, isIgnoredSectionOpen],
  );

  const rowVirtualizer = useVirtualizer({
    count: listRows.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => estimateSize,
  });

  // Focus and selection diverge only for the section header, which is focusable
  // but not selectable — so it must not touch the map selection.
  const focusRow = useCallback(
    (index: number) => {
      const row = listRows[index];
      if (!row) return;

      lastKeyboardNavigatedIndexRef.current = index;

      if (row.kind === "ignoredHeader") {
        setHeaderFocused(true);
        lastProcessedSelectedIdRef.current = null;
        onSelect(null);
        return;
      }

      setHeaderFocused(false);
      lastProcessedSelectedIdRef.current = getIdFromIssue(row.item);
      onSelect(row.item);
    },
    [listRows, getIdFromIssue, onSelect],
  );

  const toggleIgnoredSection = useCallback(() => {
    const headerIndex = listRows.findIndex(
      (row) => row.kind === "ignoredHeader",
    );
    setIgnoredSectionOpen((open) => !open);

    const focusedIndex = lastKeyboardNavigatedIndexRef.current;
    if (
      headerIndex !== -1 &&
      focusedIndex !== null &&
      focusedIndex > headerIndex
    ) {
      lastKeyboardNavigatedIndexRef.current = headerIndex;
      setHeaderFocused(true);
    }
  }, [listRows]);

  const handleItemClick = useCallback(
    (item: T, index: number) => {
      lastKeyboardNavigatedIndexRef.current = index;
      lastProcessedSelectedIdRef.current = getIdFromIssue(item);
      setHeaderFocused(false);

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
      if (listRows.length === 0) return;

      const range = rowVirtualizer.range;
      if (!range) return;

      const currentIndex = lastKeyboardNavigatedIndexRef.current ?? -1;
      const focusedRow = listRows[currentIndex];

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          focusRow(Math.min(currentIndex + 1, listRows.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          focusRow(currentIndex <= 0 ? 0 : currentIndex - 1);
          break;
        case "PageDown":
          e.preventDefault();
          focusRow(Math.min(range.endIndex, listRows.length - 1));
          break;
        case "PageUp":
          e.preventDefault();
          focusRow(Math.max(range.startIndex - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          focusRow(0);
          break;
        case "End":
          e.preventDefault();
          focusRow(listRows.length - 1);
          break;
        case "Escape":
          e.preventDefault();
          if (lastKeyboardNavigatedIndexRef.current !== null) {
            lastKeyboardNavigatedIndexRef.current = null;
            lastProcessedSelectedIdRef.current = null;
            setHeaderFocused(false);
            onSelect(null);
          } else if (onGoBack) {
            onGoBack();
          }
          break;
        case "Delete":
        case "Backspace": {
          if (!ignoring) break;
          // Claims the key before the global asset-delete shortcut sees it.
          e.preventDefault();

          if (!focusedRow || focusedRow.kind !== "item" || focusedRow.isIgnored)
            break;

          const remaining = listRows.filter(
            (row) =>
              row.kind === "item" && !row.isIgnored && row !== focusedRow,
          );
          const activeIndex = listRows
            .filter((row) => row.kind === "item" && !row.isIgnored)
            .indexOf(focusedRow);

          ignoring.onIgnore(getIdFromIssue(focusedRow.item));

          const next = remaining[activeIndex % remaining.length];
          onSelect(
            next && next.kind === "item" && remaining.length > 0
              ? next.item
              : null,
          );
          break;
        }
        case "Enter": {
          if (focusedRow?.kind === "ignoredHeader") {
            e.preventDefault();
            toggleIgnoredSection();
            break;
          }

          if (ignoring && focusedRow?.kind === "item" && focusedRow.isIgnored) {
            e.preventDefault();
            ignoring.onRestore(getIdFromIssue(focusedRow.item));
            onSelect(focusedRow.item);
            break;
          }

          if (!onItemAction || selectedItemId === null) break;
          e.preventDefault();

          const actedIndex = items.findIndex(
            (item) => getIdFromIssue(item) === selectedItemId,
          );
          const nextIssue = nextIssueToSelect(items, actedIndex);

          onItemAction(selectedItemId);
          onSelect(nextIssue);
          break;
        }
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
      listRows,
      focusRow,
      ignoring,
      toggleIgnoredSection,
      rowVirtualizer.range,
      ensureItemIsVisible,
      onSelect,
      getIdFromIssue,
      onGoBack,
      zoomIn,
      zoomOut,
      onItemAction,
      selectedItemId,
    ],
  );

  useEffect(
    function syncIndexWhenSelectedIdChangesExternally() {
      if (
        selectedItemId !== lastProcessedSelectedIdRef.current &&
        selectedItemId !== null
      ) {
        const newIndex = listRows.findIndex(
          (row) =>
            row.kind === "item" && getIdFromIssue(row.item) === selectedItemId,
        );
        if (newIndex !== -1) {
          lastKeyboardNavigatedIndexRef.current = newIndex;
          lastProcessedSelectedIdRef.current = selectedItemId;
          setHeaderFocused(false);
        }
      }
      ensureItemIsVisible();
    },
    [selectedItemId, listRows, getIdFromIssue, ensureItemIsVisible],
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
              const row = listRows[virtualRow.index];
              if (!row) return null;

              if (row.kind === "ignoredHeader") {
                return (
                  <li
                    key="ignored-header"
                    data-index={virtualRow.index}
                    className="w-full px-1"
                    ref={rowVirtualizer.measureElement}
                  >
                    <IgnoredSectionHeader
                      count={row.count}
                      isOpen={isIgnoredSectionOpen}
                      isFocused={
                        isHeaderFocused &&
                        lastKeyboardNavigatedIndexRef.current ===
                          virtualRow.index
                      }
                      onToggle={() => {
                        focusRow(virtualRow.index);
                        toggleIgnoredSection();
                        focusList();
                      }}
                    />
                  </li>
                );
              }

              const { item, itemIndex, isIgnored } = row;
              const handleClickWithIndex = (clickedIssue: T) =>
                handleItemClick(clickedIssue, virtualRow.index);

              const isItemSelected = getIdFromIssue(item) === selectedItemId;
              const itemContent = renderItem(
                itemIndex,
                item,
                selectedItemId,
                handleClickWithIndex,
                isIgnored,
              );

              const rowAction = isIgnored ? (
                <FixButton
                  label={translate("restore")}
                  icon={<UndoIcon size="md" />}
                  onFix={() => ignoring?.onRestore(getIdFromIssue(item))}
                />
              ) : (
                <>
                  {renderItemAction?.(item, isItemSelected)}
                  {ignoring ? (
                    <FixButton
                      label={translate("ignore")}
                      icon={<IgnoreIcon size="md" />}
                      onFix={() => ignoring.onIgnore(getIdFromIssue(item))}
                    />
                  ) : null}
                </>
              );

              const hasAction = isIgnored || !!ignoring || !!renderItemAction;

              return (
                <li
                  key={String(getIdFromIssue(item))}
                  data-index={virtualRow.index}
                  className="w-full px-1"
                  ref={rowVirtualizer.measureElement}
                >
                  <div
                    className={clsx(
                      "group/item flex items-center w-full rounded-sm",
                      isItemSelected ? "bg-accent-tint" : "hover:bg-base-hover",
                    )}
                  >
                    <div className="min-w-0 flex-auto">{itemContent}</div>
                    {hasAction ? (
                      <div
                        className={clsx(
                          "flex-none self-stretch flex items-center gap-x-1 pr-1",
                          isItemSelected
                            ? ""
                            : "invisible group-hover/item:visible",
                        )}
                      >
                        {rowAction}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

const nextIssueToSelect = <T,>(items: T[], index: number): T | null => {
  if (index < 0 || items.length === 0) return null;

  return items[(index + 1) % items.length] ?? null;
};
