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
import { bookmarksAtom, selectionSetsAtom } from "src/state/collections";

type SectionType = "selectionSets" | "bookmarks";

type ActionState =
  | { action: "creating"; section: SectionType }
  | { action: "renaming"; section: SectionType; id: string };

type RowKey = { section: SectionType; id: string };

type Row = RowKey & {
  navId: number;
  name: string;
};

export const CollectionsPanel = () => {
  const translate = useTranslate();
  const selectionSets = useAtomValue(selectionSetsAtom);
  const bookmarks = useAtomValue(bookmarksAtom);
  const selection = useAtomValue(selectionAtom);

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
  const [focusedRow, setFocusedRow] = useState<RowKey | null>(null);

  const { selectionRows, bookmarkRows, byNavId } = useMemo(() => {
    const selectionRows: Row[] = selectionSets.map((set, index) => ({
      navId: index + 1,
      section: "selectionSets",
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
    if (focusedRow) {
      const row = [...byNavId.values()].find((candidate) =>
        isSameRow(candidate, focusedRow),
      );
      if (row) return { id: row.navId, section: row.section };
    }
    if (focusedSection) return { section: focusedSection };
    return undefined;
  }, [focusedRow, focusedSection, byNavId]);

  const clearActionState = useCallback(() => {
    setActionState(undefined);
    requestAnimationFrame(() => listRef.current?.focus());
  }, []);

  const runRow = useCallback(
    (row: Row) => {
      if (row.section === "selectionSets") {
        applySelectionSet({ setId: row.id, source: "panel" });
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
        setFocusedSection(item.section);
        return;
      }

      const row = byNavId.get(item.id);
      if (!row) return;

      setFocusedSection(null);
      setFocusedRow({ section: row.section, id: row.id });
    },
    [byNavId],
  );

  const handleActivateItem = useCallback(
    (item: NavItem<SectionType>) => {
      const row = item.id == null ? undefined : byNavId.get(item.id);
      if (row) runRow(row);
    },
    [byNavId, runRow],
  );

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setFocusedSection(null);
    setFocusedRow(null);
  };

  const handleClickRow = (row: Row) => {
    setFocusedSection(null);
    setFocusedRow(null);
    runRow(row);
  };

  const handleNameChange = (name: string): boolean => {
    if (!actionState) return true;

    const trimmedName = name.trim();
    if (!trimmedName) return true;

    if (actionState.action === "creating") {
      if (actionState.section === "selectionSets") {
        saveSelectionSet({ name: trimmedName, source: "panel" });
      } else {
        addBookmark({ name: trimmedName, source: "panel" });
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

  const { assets, customerPoints } = USelection.countByKind(selection);
  const canSaveSelection = assets + customerPoints >= MIN_SELECTION_SET_SIZE;

  const renderRow = (row: Row) => (
    <EditableListItem
      key={row.id}
      item={{ id: row.navId, label: row.name }}
      isSelected={false}
      isFocused={focusedRow !== null && isSameRow(row, focusedRow)}
      onSelect={() => handleClickRow(row)}
      actions={itemActions}
      onAction={handleAction}
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
            label: canSaveSelection
              ? translate("collections.selectionSets.save")
              : translate("collections.selectionSets.saveDisabled"),
            disabled: !canSaveSelection,
          }}
          onAction={handleNew}
        >
          {selectionRows.map(renderRow)}
          {isCreatingIn(actionState, "selectionSets") && (
            <ItemInput
              label={translate("collections.selectionSets.newName")}
              value=""
              placeholder={translate(
                "collections.selectionSets.namePlaceholder",
              )}
              onCommit={handleNameChange}
              onCancel={clearActionState}
            />
          )}
          {selectionSets.length === 0 &&
            !isCreatingIn(actionState, "selectionSets") && (
              <EmptyRow>
                {translate("collections.selectionSets.empty")}
              </EmptyRow>
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
          onAction={handleNew}
        >
          {bookmarkRows.map(renderRow)}
          {isCreatingIn(actionState, "bookmarks") && (
            <ItemInput
              label={translate("collections.bookmarks.newName")}
              value=""
              placeholder={translate("collections.bookmarks.namePlaceholder")}
              onCommit={handleNameChange}
              onCancel={clearActionState}
            />
          )}
          {bookmarks.length === 0 &&
            !isCreatingIn(actionState, "bookmarks") && (
              <EmptyRow>{translate("collections.bookmarks.empty")}</EmptyRow>
            )}
        </CollapsibleListSection>
      </NavigableList>
    </div>
  );
};

const EmptyRow = ({ children }: { children: React.ReactNode }) => (
  <li className="px-1 py-2 text-size-base text-subtle">{children}</li>
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
