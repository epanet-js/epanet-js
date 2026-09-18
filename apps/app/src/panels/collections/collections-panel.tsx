import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "src/components/elements";
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
import { AddIcon, CloseIcon, PointerClickIcon, RenameIcon } from "src/icons";
import { USelection } from "src/selection";
import { selectionAtom } from "src/state/selection";
import {
  bookmarksAtom,
  pendingCollectionDraftAtom,
  selectionSetsAtom,
} from "src/state/collections";
import {
  type CollectionDraftSource,
  type CollectionKind,
  largestContainedSet,
} from "src/lib/collections";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useStartCollectionDraft } from "src/commands/collection-draft";

type SectionType = CollectionKind;

type ActionState =
  | { action: "creating"; section: SectionType; source: CollectionDraftSource }
  | { action: "renaming"; section: SectionType; id: string };

type RowKey = { section: SectionType; id: string };

const SECTIONS: readonly SectionType[] = ["selectionSets", "bookmarks"];

type Row = RowKey & {
  navId: number;
  name: string;
};

export const CollectionsPanel = () => {
  const translate = useTranslate();
  const moreActionsLabel = translate("moreActions");
  const selectOnlyLabel = translate("collections.selectionSets.selectOnly");
  const selectionSets = useAtomValue(selectionSetsAtom);
  const bookmarks = useAtomValue(bookmarksAtom);
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const { assets, customerPoints } = USelection.countByKind(selection);
  const canSaveSelection = assets + customerPoints >= MIN_SELECTION_SET_SIZE;

  const selectedSetId = useMemo(
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
  const startCollectionDraft = useStartCollectionDraft();

  const listRef = useRef<NavigableListHandle>(null);
  const [actionState, setActionState] = useState<ActionState | undefined>(
    undefined,
  );
  const [focusedSection, setFocusedSection] = useState<SectionType | null>(
    null,
  );
  const [focusedRow, setFocusedRow] = useState<RowKey | null>(null);
  const [focusedAddRow, setFocusedAddRow] = useState<SectionType | null>(null);
  const [pendingDraft, setPendingDraft] = useAtom(pendingCollectionDraftAtom);

  const { selectionRows, bookmarkRows, byNavId, addRowNavIds } = useMemo(() => {
    const selectionRows: Row[] = selectionSets.map((set, index) => ({
      navId: index + 1,
      section: "selectionSets",
      id: set.id,
      name: set.name,
    }));
    const bookmarkRows: Row[] = bookmarks.map((bookmark, index) => ({
      navId: selectionSets.length + index + 2,
      section: "bookmarks",
      id: bookmark.id,
      name: bookmark.name,
    }));
    const addRowNavIds: Record<SectionType, number> = {
      selectionSets: selectionSets.length + 1,
      bookmarks: selectionSets.length + bookmarks.length + 2,
    };
    const byNavId = new Map<number, Row>(
      [...selectionRows, ...bookmarkRows].map((row) => [row.navId, row]),
    );
    return { selectionRows, bookmarkRows, byNavId, addRowNavIds };
  }, [selectionSets, bookmarks]);

  const addRowSectionOf = useCallback(
    (navId: number): SectionType | undefined =>
      SECTIONS.find((section) => addRowNavIds[section] === navId),
    [addRowNavIds],
  );

  const navItems = useMemo(
    (): NavItem<SectionType>[] => [
      ...selectionRows.map((row) => ({ id: row.navId, section: row.section })),
      { id: addRowNavIds.selectionSets, section: "selectionSets" },
      ...bookmarkRows.map((row) => ({ id: row.navId, section: row.section })),
      { id: addRowNavIds.bookmarks, section: "bookmarks" },
    ],
    [selectionRows, bookmarkRows, addRowNavIds],
  );

  const focusedItem = useMemo((): NavItem<SectionType> | undefined => {
    if (focusedAddRow) {
      return { id: addRowNavIds[focusedAddRow], section: focusedAddRow };
    }
    if (focusedRow) {
      const row = [...byNavId.values()].find((candidate) =>
        isSameRow(candidate, focusedRow),
      );
      if (row) return { id: row.navId, section: row.section };
    }
    if (focusedSection) return { section: focusedSection };
    const selectedRow = selectionRows.find((row) => row.id === selectedSetId);
    if (selectedRow)
      return { id: selectedRow.navId, section: selectedRow.section };
    return undefined;
  }, [
    focusedAddRow,
    addRowNavIds,
    focusedRow,
    focusedSection,
    byNavId,
    selectionRows,
    selectedSetId,
  ]);

  const clearActionState = useCallback(() => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  }, []);

  const runRow = useCallback(
    (row: Row) => {
      if (row.section === "selectionSets") {
        applySelectionSet({ setId: row.id, zoom: true, source: "panel" });
      } else {
        goToBookmark({ bookmarkId: row.id, source: "panel" });
      }
    },
    [applySelectionSet, goToBookmark],
  );

  const handleFocusItem = useCallback(
    (item: NavItem<SectionType>) => {
      if (item.id == null) {
        setFocusedRow(null);
        setFocusedAddRow(null);
        setFocusedSection(item.section);
        return;
      }

      const addRowSection = addRowSectionOf(item.id);
      if (addRowSection) {
        setFocusedSection(null);
        setFocusedRow(null);
        setFocusedAddRow(addRowSection);
        return;
      }

      const row = byNavId.get(item.id);
      if (!row) return;

      setFocusedSection(null);
      setFocusedAddRow(null);
      setFocusedRow({ section: row.section, id: row.id });
      if (row.section === "selectionSets") {
        applySelectionSet({ setId: row.id, zoom: false, source: "panel" });
      }
    },
    [byNavId, addRowSectionOf, applySelectionSet],
  );

  const handleActivateItem = useCallback(
    (item: NavItem<SectionType>) => {
      if (item.id == null) return;

      const addRowSection = addRowSectionOf(item.id);
      if (addRowSection) {
        if (addRowSection === "selectionSets" && !canSaveSelection) return;
        startCollectionDraft({
          kind: addRowSection,
          source: "collections-add-row",
        });
        return;
      }

      const row = byNavId.get(item.id);
      if (row) runRow(row);
    },
    [byNavId, addRowSectionOf, canSaveSelection, startCollectionDraft, runRow],
  );

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setFocusedSection(null);
    setFocusedRow(null);
    setFocusedAddRow(null);
  };

  const clearKeyboardFocus = () => {
    setFocusedSection(null);
    setFocusedRow(null);
    setFocusedAddRow(null);
  };

  const handleClickRow = (row: Row) => {
    clearKeyboardFocus();
    runRow(row);
  };

  const handleSelectOnly = (row: Row) => {
    clearKeyboardFocus();
    applySelectionSet({ setId: row.id, zoom: false, source: "panel" });
  };

  const handleNameChange = (name: string): boolean => {
    if (!actionState) return true;

    const trimmedName = name.trim();
    if (!trimmedName) return true;

    if (actionState.action === "creating") {
      if (actionState.section === "selectionSets") {
        saveSelectionSet({ name: trimmedName, source: actionState.source });
      } else {
        addBookmark({ name: trimmedName, source: actionState.source });
      }
    } else if (actionState.section === "selectionSets") {
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

  useEffect(() => {
    if (!pendingDraft) return;

    setActionState({
      action: "creating",
      section: pendingDraft.kind,
      source: pendingDraft.source,
    });
    listRef.current?.openSection(pendingDraft.kind);
    setPendingDraft(null);
  }, [pendingDraft, setPendingDraft]);

  const handleNew = (section: SectionType, source: CollectionDraftSource) => {
    clearKeyboardFocus();
    startCollectionDraft({ kind: section, source });
  };

  const handleAction = (action: string, item: { id: number }) => {
    const row = byNavId.get(item.id);
    if (!row) return;

    if (action === "rename") {
      setActionState({ action: "renaming", section: row.section, id: row.id });
      return;
    }

    clearActionState();
    setFocusedRow(null);
    if (row.section === "selectionSets") {
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

  const renderRow = (row: Row) => (
    <EditableListItem
      key={row.id}
      item={{ id: row.navId, label: row.name }}
      isSelected={row.section === "selectionSets" && row.id === selectedSetId}
      isFocused={focusedRow !== null && isSameRow(row, focusedRow)}
      onSelect={() => handleClickRow(row)}
      actions={itemActions}
      onAction={handleAction}
      actionsLabel={moreActionsLabel}
      secondaryAction={
        row.section === "selectionSets"
          ? {
              label: selectOnlyLabel,
              icon: <PointerClickIcon size="md" />,
              onClick: () => handleSelectOnly(row),
            }
          : undefined
      }
      editLabelMode={getEditMode(actionState, row)}
      onLabelChange={handleNameChange}
      onCancel={clearActionState}
    />
  );

  return (
    <div className="flex flex-col h-full" onBlur={handleBlur}>
      <NavigableList
        ref={listRef}
        navItems={navItems}
        focusedItem={focusedItem}
        onSelectItem={handleFocusItem}
        onActivateItem={handleActivateItem}
        isNavBlocked={!!actionState}
      >
        <CollapsibleListSection
          sectionType="selectionSets"
          title={translate("collections.selectionSets.title")}
          count={selectionSets.length}
          isFocused={focusedSection === "selectionSets"}
          action={{
            icon: <AddIcon />,
            label: translate("collections.selectionSets.save"),
            disabled: !canSaveSelection,
          }}
          onAction={() => handleNew("selectionSets", "collections-heading")}
        >
          {selectionRows.map(renderRow)}
          {isCreatingIn(actionState, "selectionSets") ? (
            <ItemInput
              label={translate("collections.selectionSets.newName")}
              value=""
              placeholder={translate(
                "collections.selectionSets.namePlaceholder",
              )}
              onCommit={handleNameChange}
              onCancel={clearActionState}
            />
          ) : (
            <CurrentStateRow
              label={
                canSaveSelection
                  ? translate("collections.selectionSets.saveCurrent")
                  : translate("collections.selectionSets.nothingSelected")
              }
              count={canSaveSelection ? assets + customerPoints : undefined}
              navId={addRowNavIds.selectionSets}
              isFocused={focusedAddRow === "selectionSets"}
              isDisabled={!canSaveSelection}
              onAdd={() => handleNew("selectionSets", "collections-add-row")}
            />
          )}
        </CollapsibleListSection>

        <CollapsibleListSection
          sectionType="bookmarks"
          title={translate("collections.bookmarks.title")}
          count={bookmarks.length}
          isFocused={focusedSection === "bookmarks"}
          action={{
            icon: <AddIcon />,
            label: translate("collections.bookmarks.add"),
          }}
          onAction={() => handleNew("bookmarks", "collections-heading")}
        >
          {bookmarkRows.map(renderRow)}
          {isCreatingIn(actionState, "bookmarks") ? (
            <ItemInput
              label={translate("collections.bookmarks.newName")}
              value=""
              placeholder={translate("collections.bookmarks.namePlaceholder")}
              onCommit={handleNameChange}
              onCancel={clearActionState}
            />
          ) : (
            <CurrentStateRow
              label={translate("collections.bookmarks.saveCurrent")}
              navId={addRowNavIds.bookmarks}
              isFocused={focusedAddRow === "bookmarks"}
              onAdd={() => handleNew("bookmarks", "collections-add-row")}
            />
          )}
        </CollapsibleListSection>
      </NavigableList>
    </div>
  );
};

const CurrentStateRow = ({
  label,
  count,
  navId,
  isFocused,
  isDisabled = false,
  onAdd,
}: {
  label: string;
  count?: number;
  navId: number;
  isFocused: boolean;
  isDisabled?: boolean;
  onAdd: () => void;
}) => (
  <li
    data-item-id={navId}
    className={clsx(
      "flex items-center text-sm h-8 min-w-0 rounded-sm",
      isFocused && "bg-base-hover",
      !isFocused && !isDisabled && "hover:bg-base-hover",
    )}
  >
    <Button
      variant="quiet/list"
      size="sm"
      disabled={isDisabled}
      onClick={onAdd}
      className="flex-1 min-w-0 self-stretch justify-start hover:bg-transparent dark:hover:bg-transparent"
    >
      <span className="flex items-center gap-1 min-w-0 text-subtle">
        <AddIcon />
        <span className="truncate">{label}</span>
        {count !== undefined && (
          <span className="shrink-0">({count.toLocaleString()})</span>
        )}
      </span>
    </Button>
  </li>
);

const isSameRow = (a: RowKey, b: RowKey) =>
  a.section === b.section && a.id === b.id;

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
