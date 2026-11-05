import clsx from "clsx";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useAtom, useAtomValue } from "jotai";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useCreateSelectionSetGroup } from "src/commands/selection-set-groups";
import { Button, DDContent, StyledItem } from "src/components/elements";
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
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useTranslate } from "src/hooks/use-translate";
import {
  AddIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  PaywallLockIcon,
  PointerClickIcon,
  RenameIcon,
} from "src/icons";
import { PaywallUpgradeBox, useFeatureLock } from "src/components/form/paywall";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { selectionAtom } from "src/state/selection";
import {
  bookmarksAtom,
  pendingCollectionDraftAtom,
  selectionSetGroupsAtom,
  selectionSetsAtom,
} from "src/state/collections";
import {
  type CollectionDraftSource,
  type CollectionKind,
  type SelectionSetGroupId,
  type SelectionSetId,
  countSelected,
  largestContainedSet,
  matchesSelectionExactly,
  savableSelection,
} from "src/lib/collections";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useStartCollectionDraft } from "src/commands/collection-draft";

type SectionType = CollectionKind;

type ActionState =
  | {
      action: "creating";
      section: SectionType;
      source: CollectionDraftSource;
      label: string;
    }
  | { action: "creatingGroup"; parentId: SelectionSetGroupId | null }
  | { action: "renaming"; section: SectionType; id: string };

type RowKey = { section: SectionType; id: string };

const SECTIONS: readonly SectionType[] = ["selectionSets", "bookmarks"];

type Row = RowKey & {
  navId: number;
  label: string;
  kind: "set" | "group" | "bookmark";
};

export const CollectionsPanel = () => {
  const translate = useTranslate();
  const moreActionsLabel = translate("moreActions");
  const selectOnlyLabel = translate("collections.selectionSets.selectOnly");
  const { isLocked, openPaywall } = useFeatureLock("selectionSets");
  const isGroupsOn = useFeatureFlag("FLAG_SELECTION_SET_GROUPS");
  const selectionSets = useAtomValue(selectionSetsAtom);
  const selectionSetGroups = useAtomValue(selectionSetGroupsAtom);
  const bookmarks = useAtomValue(bookmarksAtom);
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const isZoneSelectionOn = useFeatureFlag("FLAG_ZONE_SELECTION");
  const savableCount = countSelected(
    savableSelection(selection, isZoneSelectionOn),
  );
  const canSaveSelection = savableCount >= MIN_SELECTION_SET_SIZE;

  const [appliedSetId, setAppliedSetId] = useState<SelectionSetId | null>(null);

  const selectedSetId = useMemo(() => {
    const applied = selectionSets.find((set) => set.id === appliedSetId);
    if (applied && matchesSelectionExactly(applied, selection, hydraulicModel))
      return applied.id;

    return largestContainedSet(selectionSets, selection, hydraulicModel);
  }, [selectionSets, selection, hydraulicModel, appliedSetId]);

  const saveSelectionSet = useSaveSelectionSet();
  const applySelectionSet = useApplySelectionSet();
  const renameSelectionSet = useRenameSelectionSet();
  const deleteSelectionSet = useDeleteSelectionSet();
  const createSelectionSetGroup = useCreateSelectionSetGroup();
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
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<
    ReadonlySet<SelectionSetGroupId>
  >(() => new Set());
  const [pendingDraft, setPendingDraft] = useAtom(pendingCollectionDraftAtom);

  const { groupRows, selectionRows, bookmarkRows, byNavId, addRowNavIds } =
    useMemo(() => {
      let navId = 0;
      const groupRows: Row[] = isGroupsOn
        ? selectionSetGroups
            .filter((group) => group.parentId === null)
            .map((group) => ({
              navId: ++navId,
              section: "selectionSets",
              id: group.id,
              label: group.label,
              kind: "group",
            }))
        : [];
      const selectionRows: Row[] = selectionSets.map((set) => ({
        navId: ++navId,
        section: "selectionSets",
        id: set.id,
        label: set.label,
        kind: "set",
      }));
      const selectionSetsAddRowNavId = isGroupsOn ? undefined : ++navId;
      const bookmarkRows: Row[] = bookmarks.map((bookmark) => ({
        navId: ++navId,
        section: "bookmarks",
        id: bookmark.id,
        label: bookmark.label,
        kind: "bookmark",
      }));
      const addRowNavIds: { selectionSets?: number; bookmarks: number } = {
        selectionSets: selectionSetsAddRowNavId,
        bookmarks: ++navId,
      };
      const byNavId = new Map<number, Row>(
        [...groupRows, ...selectionRows, ...bookmarkRows].map((row) => [
          row.navId,
          row,
        ]),
      );
      return { groupRows, selectionRows, bookmarkRows, byNavId, addRowNavIds };
    }, [isGroupsOn, selectionSetGroups, selectionSets, bookmarks]);

  const addRowSectionOf = useCallback(
    (navId: number): SectionType | undefined =>
      SECTIONS.find((section) => addRowNavIds[section] === navId),
    [addRowNavIds],
  );

  const navItems = useMemo(
    (): NavItem<SectionType>[] => [
      ...groupRows.map((row) => ({ id: row.navId, section: row.section })),
      ...selectionRows.map((row) => ({ id: row.navId, section: row.section })),
      ...(addRowNavIds.selectionSets !== undefined
        ? [
            {
              id: addRowNavIds.selectionSets,
              section: "selectionSets" as const,
            },
          ]
        : []),
      ...bookmarkRows.map((row) => ({ id: row.navId, section: row.section })),
      { id: addRowNavIds.bookmarks, section: "bookmarks" },
    ],
    [groupRows, selectionRows, bookmarkRows, addRowNavIds],
  );

  const focusedItem = useMemo((): NavItem<SectionType> | undefined => {
    if (focusedAddRow && addRowNavIds[focusedAddRow] !== undefined) {
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
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body)
        return;
      listRef.current?.focus();
    });
  }, []);

  const toggleGroup = useCallback((groupId: SelectionSetGroupId) => {
    setCollapsedGroupIds((collapsed) => {
      const next = new Set(collapsed);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const runRow = useCallback(
    (row: Row) => {
      if (row.kind === "group") {
        toggleGroup(row.id);
      } else if (row.kind === "set") {
        setAppliedSetId(row.id);
        applySelectionSet({ setId: row.id, zoom: true, source: "panel" });
      } else {
        goToBookmark({ bookmarkId: row.id, source: "panel" });
      }
    },
    [applySelectionSet, goToBookmark, toggleGroup],
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
      if (row.kind === "set") {
        setAppliedSetId(row.id);
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
          label: "",
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
    setAppliedSetId(row.id);
    applySelectionSet({ setId: row.id, zoom: false, source: "panel" });
  };

  const handleLabelChange = (label: string): boolean => {
    if (!actionState) return true;

    const trimmedLabel = label.trim();
    if (!trimmedLabel) return true;

    if (actionState.action === "creatingGroup") {
      createSelectionSetGroup({
        label: trimmedLabel,
        parentId: actionState.parentId,
        source: "panel",
      });
    } else if (actionState.action === "creating") {
      if (actionState.section === "selectionSets") {
        saveSelectionSet({ label: trimmedLabel, source: actionState.source });
      } else {
        addBookmark({ label: trimmedLabel, source: actionState.source });
      }
    } else if (actionState.section === "selectionSets") {
      renameSelectionSet({
        setId: actionState.id,
        label: trimmedLabel,
        source: "panel",
      });
    } else {
      renameBookmark({
        bookmarkId: actionState.id,
        label: trimmedLabel,
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
      label: pendingDraft.label,
    });
    listRef.current?.openSection(pendingDraft.kind);
    setPendingDraft(null);
  }, [pendingDraft, setPendingDraft]);

  const handleNew = (section: SectionType, source: CollectionDraftSource) => {
    clearKeyboardFocus();
    startCollectionDraft({ kind: section, source, label: "" });
  };

  const handleNewGroup = (parentId: SelectionSetGroupId | null) => {
    clearKeyboardFocus();
    if (isLocked) return openPaywall();
    listRef.current?.openSection("selectionSets");
    setActionState({ action: "creatingGroup", parentId });
  };

  const handleAction = (action: string, item: { id: number }) => {
    const row = byNavId.get(item.id);
    if (!row) return;

    if (isLocked) return openPaywall();

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

  const draftLabel =
    actionState?.action === "creating" ? actionState.label : "";

  const isSelectionSectionEmpty =
    groupRows.length === 0 &&
    selectionRows.length === 0 &&
    !isCreatingIn(actionState, "selectionSets") &&
    actionState?.action !== "creatingGroup";

  const renderGroupRow = (row: Row) => {
    const isCollapsed = collapsedGroupIds.has(row.id);
    return (
      <Fragment key={row.id}>
        <li
          data-item-id={row.navId}
          className={clsx(
            "group flex items-center text-sm cursor-pointer h-8 min-w-0 rounded-sm",
            focusedRow !== null && isSameRow(row, focusedRow)
              ? "bg-base-hover"
              : "hover:bg-base-hover",
          )}
        >
          <Button
            variant="quiet/list"
            size="sm"
            onClick={() => handleClickRow(row)}
            className="flex-1 min-w-0 justify-start hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0! focus-visible:ring-offset-0!"
          >
            {isCollapsed ? (
              <ChevronRightIcon size="sm" />
            ) : (
              <ChevronDownIcon size="sm" />
            )}
            <span className="truncate">{row.label}</span>
          </Button>
        </li>
        {!isCollapsed && (
          <HintRow
            label={translate("collections.groups.empty")}
            className="pl-6"
          />
        )}
      </Fragment>
    );
  };

  const renderRow = (row: Row) => (
    <EditableListItem
      key={row.id}
      item={{ id: row.navId, label: row.label }}
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
      onLabelChange={handleLabelChange}
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
          actionSlot={
            isGroupsOn ? (
              <AddMenu
                label={translate("collections.selectionSets.add")}
                isLocked={isLocked}
                onLockedClick={openPaywall}
                items={[
                  {
                    action: "group",
                    label: translate("collections.groups.new"),
                  },
                  {
                    action: "set",
                    label: translate("collections.selectionSets.new"),
                    disabled: !canSaveSelection,
                  },
                ]}
                onAction={(action) =>
                  action === "group"
                    ? handleNewGroup(null)
                    : handleNew("selectionSets", "collections-heading")
                }
              />
            ) : undefined
          }
        >
          {actionState?.action === "creatingGroup" &&
            actionState.parentId === null && (
              <ItemInput
                label={translate("collections.groups.newLabel")}
                value=""
                placeholder={translate("collections.groups.labelPlaceholder")}
                onCommit={handleLabelChange}
                onCancel={clearActionState}
              />
            )}
          {groupRows.map(renderGroupRow)}
          {selectionRows.map(renderRow)}
          {isGroupsOn && isSelectionSectionEmpty && (
            <HintRow
              label={
                canSaveSelection
                  ? translate("collections.selectionSets.saveCurrent")
                  : translate("collections.selectionSets.nothingSelected")
              }
            />
          )}
          {isCreatingIn(actionState, "selectionSets") ? (
            <ItemInput
              label={translate("collections.selectionSets.newLabel")}
              value={draftLabel}
              forceValidation={draftLabel !== ""}
              placeholder={translate(
                "collections.selectionSets.labelPlaceholder",
              )}
              onCommit={handleLabelChange}
              onCancel={clearActionState}
            />
          ) : (
            addRowNavIds.selectionSets !== undefined && (
              <CurrentStateRow
                label={
                  canSaveSelection
                    ? translate("collections.selectionSets.saveCurrent")
                    : translate("collections.selectionSets.nothingSelected")
                }
                count={canSaveSelection ? savableCount : undefined}
                navId={addRowNavIds.selectionSets}
                isFocused={focusedAddRow === "selectionSets"}
                isDisabled={!canSaveSelection}
                isLocked={isLocked}
                onAdd={() => handleNew("selectionSets", "collections-add-row")}
              />
            )
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
              label={translate("collections.bookmarks.newLabel")}
              value={draftLabel}
              forceValidation={draftLabel !== ""}
              placeholder={translate("collections.bookmarks.labelPlaceholder")}
              onCommit={handleLabelChange}
              onCancel={clearActionState}
            />
          ) : (
            <CurrentStateRow
              label={translate("collections.bookmarks.saveCurrent")}
              navId={addRowNavIds.bookmarks}
              isFocused={focusedAddRow === "bookmarks"}
              isLocked={isLocked}
              onAdd={() => handleNew("bookmarks", "collections-add-row")}
            />
          )}
        </CollapsibleListSection>
      </NavigableList>
      {isLocked && (
        <div className="shrink-0">
          <PaywallUpgradeBox
            feature="selectionSets"
            title={translate("collections.upgrade.title")}
            description={translate("collections.upgrade.description")}
          />
        </div>
      )}
    </div>
  );
};

const CurrentStateRow = ({
  label,
  count,
  navId,
  isFocused,
  isDisabled = false,
  isLocked = false,
  onAdd,
}: {
  label: string;
  count?: number;
  navId: number;
  isFocused: boolean;
  isDisabled?: boolean;
  isLocked?: boolean;
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
        {isLocked && !isDisabled ? <PaywallLockIcon size="sm" /> : <AddIcon />}
        <span className="truncate">{label}</span>
        {count !== undefined && (
          <span className="shrink-0">({count.toLocaleString()})</span>
        )}
      </span>
    </Button>
  </li>
);

const AddMenu = ({
  label,
  isLocked,
  onLockedClick,
  items,
  onAction,
}: {
  label: string;
  isLocked: boolean;
  onLockedClick: () => void;
  items: { action: string; label: string; disabled?: boolean }[];
  onAction: (action: string) => void;
}) => {
  const buttonClassName = "h-6 w-6 shrink-0 justify-center hover:bg-base-hover";

  if (isLocked) {
    return (
      <Button
        variant="quiet"
        size="xxs"
        aria-label={label}
        onClick={onLockedClick}
        className={buttonClassName}
      >
        <PaywallLockIcon size="sm" />
      </Button>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex shrink-0">
      <DD.Root modal={false}>
        <DD.Trigger asChild>
          <Button
            variant="quiet"
            size="xxs"
            aria-label={label}
            className={`${buttonClassName} aria-expanded:bg-base-hover`}
          >
            <AddIcon />
          </Button>
        </DD.Trigger>
        <DD.Portal>
          <DDContent
            align="end"
            side="bottom"
            className="z-50"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {items.map((item) => (
              <StyledItem
                key={item.action}
                disabled={item.disabled}
                className={item.disabled ? "opacity-60" : undefined}
                onSelect={() => onAction(item.action)}
              >
                {item.label}
              </StyledItem>
            ))}
          </DDContent>
        </DD.Portal>
      </DD.Root>
    </div>
  );
};

const HintRow = ({
  label,
  className,
}: {
  label: string;
  className?: string;
}) => (
  <li
    className={clsx(
      "flex items-center text-sm h-8 min-w-0 pl-2 text-subtle",
      className,
    )}
  >
    <span className="truncate">{label}</span>
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
