import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useContext,
} from "react";

export type NavItem<S extends string = string> = { id?: number; section: S };

export type NavigableListHandle = {
  openSection: (section: string) => void;
  focus: () => void;
  querySelector: (selector: string) => Element | null;
};

export const NavigableListContext = createContext<{
  sectionStatus: Record<string, boolean>;
  toggleSection: (section: string) => void;
} | null>(null);

export const useNavigableListContext = () => useContext(NavigableListContext);

type NavigableListProps<S extends string> = {
  navItems: NavItem<S>[];
  focusedItem?: NavItem<S>;
  onSelectItem: (item: NavItem<S>) => void;
  isNavBlocked?: boolean;
  children: React.ReactNode;
};

function NavigableListInner<S extends string>(
  {
    navItems,
    focusedItem,
    onSelectItem,
    isNavBlocked,
    children,
  }: NavigableListProps<S>,
  ref: React.ForwardedRef<NavigableListHandle>,
) {
  const listRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of navItems) {
      if (!seen.has(item.section)) {
        seen.add(item.section);
        result.push(item.section);
      }
    }
    return result;
  }, [navItems]);

  const [sectionStatus, setSectionStatus] = useState<Record<string, boolean>>(
    () => {
      const status: Record<string, boolean> = {};
      for (const section of sections) {
        if (focusedItem?.section) {
          status[section] = section === focusedItem.section;
        } else {
          status[section] = section !== "uncategorized";
        }
      }
      return status;
    },
  );

  // Keep sectionStatus in sync when sections appear/disappear
  const prevSectionsRef = useRef(sections);
  if (prevSectionsRef.current !== sections) {
    const prevSet = new Set(prevSectionsRef.current);
    const newSections = sections.filter((s) => !prevSet.has(s));
    if (newSections.length > 0) {
      const updated = { ...sectionStatus };
      for (const section of newSections) {
        updated[section] = section !== "uncategorized";
      }
      setSectionStatus(updated);
    }
    prevSectionsRef.current = sections;
  }

  const toggleSection = useCallback((section: string) => {
    setSectionStatus((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const openSection = useCallback((section: string) => {
    setSectionStatus((prev) => ({
      ...prev,
      [section]: true,
    }));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openSection,
      focus: () => listRef.current?.focus(),
      querySelector: (selector: string) =>
        listRef.current?.querySelector(selector) ?? null,
    }),
    [openSection],
  );

  const contextValue = useMemo(
    () => ({ sectionStatus, toggleSection }),
    [sectionStatus, toggleSection],
  );

  const handleScroll = useCallback(() => {
    listRef.current?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
  }, []);

  const fullNavItems = useMemo(() => {
    const result: NavItem<S>[] = [];
    const itemsBySection = new Map<string, NavItem<S>[]>();
    for (const item of navItems) {
      if (!itemsBySection.has(item.section)) {
        itemsBySection.set(item.section, []);
      }
      itemsBySection.get(item.section)!.push(item);
    }
    for (const section of Object.keys(sectionStatus) as S[]) {
      result.push({ section });
      if (sectionStatus[section]) {
        result.push(...(itemsBySection.get(section) ?? []));
      }
    }
    return result;
  }, [navItems, sectionStatus]);

  const currentNavIndex = useMemo(() => {
    if (focusedItem) {
      return fullNavItems.findIndex(
        (item) =>
          item.section === focusedItem.section && item.id === focusedItem.id,
      );
    }
    return -1;
  }, [focusedItem, fullNavItems]);

  const navigateToItem = useCallback(
    (item: NavItem<S>) => {
      onSelectItem(item);
      listRef.current?.focus();
      const querySelector = item.id
        ? `[data-item-id="${item.id}"]`
        : `[data-section-type="${item.section}"]`;
      const el = listRef.current?.querySelector(querySelector);
      el?.scrollIntoView({ block: "nearest" });
    },
    [onSelectItem],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isNavBlocked) return;

      if (e.key === "Enter" && focusedItem && focusedItem.id == null) {
        e.preventDefault();
        e.stopPropagation();
        toggleSection(focusedItem.section);
        return;
      }

      if (e.key === "Escape" && focusedItem) {
        e.preventDefault();
        e.stopPropagation();
        if (focusedItem.id != null) {
          navigateToItem({ section: focusedItem.section });
        }
        return;
      }

      const validKeys = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
      ];
      if (!validKeys.includes(e.key)) return;
      if (fullNavItems.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      const itemHeight = 32; // h-8
      const containerHeight = listRef.current?.clientHeight ?? itemHeight;
      const pageSize = Math.max(1, Math.floor(containerHeight / itemHeight));

      let nextIndex: number;
      switch (e.key) {
        case "ArrowDown":
          nextIndex =
            currentNavIndex < fullNavItems.length - 1 ? currentNavIndex + 1 : 0;
          break;
        case "ArrowUp":
          nextIndex =
            currentNavIndex > 0 ? currentNavIndex - 1 : fullNavItems.length - 1;
          break;
        case "PageDown":
          nextIndex = Math.min(
            currentNavIndex + pageSize,
            fullNavItems.length - 1,
          );
          break;
        case "PageUp":
          nextIndex = Math.max(currentNavIndex - pageSize, 0);
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = fullNavItems.length - 1;
          break;
        default:
          return;
      }

      navigateToItem(fullNavItems[nextIndex]);
    },
    [
      isNavBlocked,
      focusedItem,
      fullNavItems,
      navigateToItem,
      toggleSection,
      currentNavIndex,
    ],
  );

  return (
    <NavigableListContext.Provider value={contextValue}>
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto outline-none placemark-scrollbar scroll-shadows border border-gray-200 dark:border-gray-700 rounded"
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        tabIndex={0}
        {...(focusedItem?.id && {
          "data-capture-escape-key": true,
        })}
      >
        {children}
      </div>
    </NavigableListContext.Provider>
  );
}

export const NavigableList = forwardRef(NavigableListInner) as <
  S extends string = string,
>(
  props: NavigableListProps<S> & React.RefAttributes<NavigableListHandle>,
) => React.ReactElement | null;
