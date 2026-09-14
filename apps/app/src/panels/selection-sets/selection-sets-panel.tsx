import { useAtomValue } from "jotai";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  useAddBookmark,
  useDeleteBookmark,
  useGoToBookmark,
  useRenameBookmark,
} from "src/commands/bookmarks";
import {
  MIN_SELECTION_SET_SIZE,
  useApplySelectionSet,
  useDeleteSelectionSet,
  useRenameSelectionSet,
  useSaveSelectionSet,
} from "src/commands/selection-sets";
import {
  CollapsibleListSection,
  EditableListItem,
  ItemInput,
  NavigableList,
} from "src/components/list";
import type {
  ItemAction,
  NavItem,
  NavigableListHandle,
} from "src/components/list";
import { useTranslate } from "src/hooks/use-translate";
import { AddIcon, CloseIcon, RenameIcon } from "src/icons";
import { USelection } from "src/selection";
import { selectionAtom } from "src/state/selection";
import { largestContainedSet } from "src/lib/selection-sets";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { bookmarksAtom, selectionSetsAtom } from "src/state/selection-sets";

type SectionType = "selections" | "bookmarks";

type ActionState =
  | { action: "creating"; section: SectionType }
  | { action: "renaming"; section: SectionType; id: string };

type Row = {
  navId: number;
  section: SectionType;
  id: string;
  name: string;
};

export const SelectionSetsPanel = () => {
  const translate = useTranslate();
  const selectionSets = useAtomValue(selectionSetsAtom);
  const bookmarks = useAtomValue(bookmarksAtom);
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const matchedSelectionSetId = useMemo(
    () => largestContainedSet(selectionSets, selection, hydraulicModel),
    [selectionSets, selection, hydraulicModel],
  );

  const saveSelectionSet = useSaveSelectionSet();
  const applySelectionSet = useApplySelectionSet();
  const renameSelectionSet = useRenameSelectionSet();
  const deleteSelectionSet = useDeleteSelectionSet();
  const addBookmark = useAddBookmark();
  const goToBookmark = useGoToBookmark();
  const renameBookmark = useRenameBookmark();
  const deleteBookmark = useDeleteBookmark();

  const listRef = useRef<NavigableListHandle>(null);
  const [actionState, setActionState] = useState<ActionState | undefined>(
    undefined,
  );
  const [focusedSection, setFocusedSection] = useState<SectionType | null>(
    null,
  );
  const [focusedNavId, setFocusedNavId] = useState<number | null>(null);

  const { selectionRows, bookmarkRows, byNavId } = useMemo(() => {
    const selectionRows: Row[] = selectionSets.map((set, index) => ({
      navId: index + 1,
      section: "selections",
      id: set.id,
      name: set.name,
    }));
    const bookmarkRows: Row[] = bookmarks.map((bookmark, index) => ({
      navId: selectionSets.length + index + 1,
      section: "bookmarks",
      id: bookmark.id,
      name: bookmark.name,
    }));
    const byNavId = new Map<number, Row>(
      [...selectionRows, ...bookmarkRows].map((row) => [row.navId, row]),
    );
    return { selectionRows, bookmarkRows, byNavId };
  }, [selectionSets, bookmarks]);

  const navItems = useMemo(
    (): NavItem<SectionType>[] => [
      ...selectionRows.map((row) => ({ id: row.navId, section: row.section })),
      ...bookmarkRows.map((row) => ({ id: row.navId, section: row.section })),
    ],
    [selectionRows, bookmarkRows],
  );

  const focusedItem = useMemo((): NavItem<SectionType> | undefined => {
    if (focusedNavId !== null) {
      const row = byNavId.get(focusedNavId);
      if (row) return { id: row.navId, section: row.section };
    }
    if (focusedSection) return { section: focusedSection };
    return undefined;
  }, [focusedNavId, focusedSection, byNavId]);

  const clearActionState = useCallback(() => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  }, []);

  const handleSelectItem = useCallback(
    (item: NavItem<SectionType>) => {
      if (item.id == null) {
        setFocusedNavId(null);
        setFocusedSection(item.section);
        return;
      }

      const row = byNavId.get(item.id);
      if (!row) return;

      setFocusedSection(null);
      setFocusedNavId(row.navId);

      if (row.section === "selections") {
        applySelectionSet({ setId: row.id, source: "panel" });
      } else {
        goToBookmark({ bookmarkId: row.id, source: "panel" });
      }
    },
    [byNavId, applySelectionSet, goToBookmark],
  );

  const handleNameChange = (name: string): boolean => {
    if (!actionState) return true;

    const trimmedName = name.trim();
    if (!trimmedName) return true;

    if (actionState.action === "creating") {
      if (actionState.section === "selections") {
        saveSelectionSet({ name: trimmedName, source: "panel" });
      } else {
        addBookmark({ name: trimmedName, source: "panel" });
      }
    } else if (actionState.section === "selections") {
      renameSelectionSet({
        setId: actionState.id,
        name: trimmedName,
        source: "panel",
      });
    } else {
      renameBookmark({
        bookmarkId: actionState.id,
        name: trimmedName,
        source: "panel",
      });
    }

    clearActionState();
    return false;
  };

  const handleNew = (section: string) => {
    setActionState({ action: "creating", section: section as SectionType });
    listRef.current?.openSection(section);
  };

  const handleAction = (action: string, item: { id: number }) => {
    const row = byNavId.get(item.id);
    if (!row) return;

    if (action === "rename") {
      setActionState({ action: "renaming", section: row.section, id: row.id });
      return;
    }

    clearActionState();
    setFocusedNavId(null);
    if (row.section === "selections") {
      deleteSelectionSet({ setId: row.id, source: "panel" });
    } else {
      deleteBookmark({ bookmarkId: row.id, source: "panel" });
    }
  };

  const itemActions: ItemAction[] = [
    {
      action: "rename",
      label: translate("rename"),
      icon: <RenameIcon size="sm" />,
    },
    {
      action: "delete",
      label: translate("delete"),
      icon: <CloseIcon size="sm" />,
      variant: "destructive",
    },
  ];

  const { assets, customerPoints } = USelection.countByKind(selection);
  const canSaveSelection = assets + customerPoints >= MIN_SELECTION_SET_SIZE;

  const renderRow = (row: Row) => (
    <EditableListItem
      key={row.id}
      item={{ id: row.navId, label: row.name }}
      isSelected={
        row.section === "selections"
          ? matchedSelectionSetId === row.id
          : focusedNavId === row.navId
      }
      onSelect={() => handleSelectItem({ id: row.navId, section: row.section })}
      actions={itemActions}
      onAction={handleAction}
      editLabelMode={getEditMode(actionState, row)}
      onLabelChange={handleNameChange}
      onCancel={clearActionState}
    />
  );

  return (
    <div className="flex flex-col h-full">
      <NavigableList
        ref={listRef}
        navItems={navItems}
        focusedItem={focusedItem}
        onSelectItem={handleSelectItem}
        isNavBlocked={!!actionState}
      >
        <CollapsibleListSection
          sectionType="selections"
          title="Selections"
          count={selectionSets.length}
          isFocused={focusedSection === "selections"}
          action={{
            icon: <AddIcon />,
            label: canSaveSelection
              ? "Save selection"
              : "Save selection — select two or more items first",
            disabled: !canSaveSelection,
          }}
          onAction={handleNew}
        >
          {selectionRows.map(renderRow)}
          {isCreatingIn(actionState, "selections") && (
            <ItemInput
              label="New selection name"
              value=""
              placeholder="Selection name"
              onCommit={handleNameChange}
              onCancel={clearActionState}
            />
          )}
          {selectionSets.length === 0 &&
            !isCreatingIn(actionState, "selections") && (
              <EmptyRow>
                Select two or more assets on the map, then press + to save the
                selection.
              </EmptyRow>
            )}
        </CollapsibleListSection>

        <CollapsibleListSection
          sectionType="bookmarks"
          title="Bookmarks"
          count={bookmarks.length}
          isFocused={focusedSection === "bookmarks"}
          action={{ icon: <AddIcon />, label: "Add bookmark" }}
          onAction={handleNew}
        >
          {bookmarkRows.map(renderRow)}
          {isCreatingIn(actionState, "bookmarks") && (
            <ItemInput
              label="New bookmark name"
              value=""
              placeholder="Bookmark name"
              onCommit={handleNameChange}
              onCancel={clearActionState}
            />
          )}
          {bookmarks.length === 0 &&
            !isCreatingIn(actionState, "bookmarks") && (
              <EmptyRow>Press + to name the area you are looking at.</EmptyRow>
            )}
        </CollapsibleListSection>
      </NavigableList>
    </div>
  );
};

const EmptyRow = ({ children }: { children: React.ReactNode }) => (
  <li className="px-1 py-2 text-size-base text-subtle">{children}</li>
);

const isCreatingIn = (
  actionState: ActionState | undefined,
  section: SectionType,
) => actionState?.action === "creating" && actionState.section === section;

const getEditMode = (actionState: ActionState | undefined, row: Row) =>
  actionState?.action === "renaming" &&
  actionState.section === row.section &&
  actionState.id === row.id
    ? "inline"
    : null;
