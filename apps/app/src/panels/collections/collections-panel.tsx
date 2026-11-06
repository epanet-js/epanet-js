import clsx from "clsx";
import * as DD from "@radix-ui/react-dropdown-menu";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
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
  useMoveSelectionSet,
  useRenameSelectionSet,
  useSaveSelectionSet,
} from "src/commands/selection-sets";
import {
  useCreateSelectionSetGroup,
  useDeleteSelectionSetGroup,
  useMoveSelectionSetGroup,
  useRenameSelectionSetGroup,
} from "src/commands/selection-set-groups";
import { Button, DDContent, StyledItem } from "src/components/elements";
import {
  CollapsibleListSection,
  EditableListItem,
  IndentGuides,
  rowGuides,
  ItemActions,
  ItemInput,
  NavigableList,
} from "src/components/list";
import type {
  IndentGuide,
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
  FolderInputIcon,
  PaywallLockIcon,
  PointerClickIcon,
  RenameIcon,
} from "src/icons";
import { PaywallUpgradeBox, useFeatureLock } from "src/components/form/paywall";
import { isNodeAsset } from "@epanet-js/hydraulic-model";
import { USelection } from "src/selection";
import { type Highlight, highlightsAtom } from "src/state/highlights";
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
  ancestorGroupIds,
  childGroups,
  countSelected,
  descendantGroupIds,
  groupPath,
  largestContainedSet,
  matchesSelectionExactly,
  setsInGroupSubtree,
} from "src/lib/collections";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { dialogAtom } from "src/state/dialog";
import { useStartCollectionDraft } from "src/commands/collection-draft";

type SectionType = CollectionKind;

type ActionState =
  | {
      action: "creating";
      section: SectionType;
      source: CollectionDraftSource;
      label: string;
      groupId: SelectionSetGroupId | null;
    }
  | { action: "creatingGroup"; parentId: SelectionSetGroupId | null }
  | { action: "renaming"; section: SectionType; id: string }
  | { action: "renamingGroup"; id: SelectionSetGroupId };

type RowKey = { section: SectionType; id: string };

const SECTIONS: readonly SectionType[] = ["selectionSets", "bookmarks"];

type Row = RowKey & {
  navId: number;
  label: string;
  kind: "set" | "group" | "bookmark";
  depth: number;
  groupId: SelectionSetGroupId | null;
  hidden: boolean;
  count?: number;
  addRowNavId?: number;
  trailing: boolean[];
};

type AddRowTarget = SectionType | { groupId: SelectionSetGroupId };

const MOVE_ACTION_PREFIX = "move:";

export const CollectionsPanel = () => {
  const translate = useTranslate();
  const moreActionsLabel = translate("moreActions");
  const selectOnlyLabel = translate("collections.selectionSets.selectOnly");
  const { isLocked, openPaywall } = useFeatureLock("selectionSets");
  const isGroupsOn = useFeatureFlag("FLAG_SELECTION_SET_GROUPS");
  const isHighlightOn = useFeatureFlag("FLAG_HIGHLIGHT_SELECTION_SETS");
  const selectionSets = useAtomValue(selectionSetsAtom);
  const selectionSetGroups = useAtomValue(selectionSetGroupsAtom);
  const bookmarks = useAtomValue(bookmarksAtom);
  const selection = useAtomValue(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const selectedCount = countSelected(selection);
  const canSaveSelection = selectedCount >= MIN_SELECTION_SET_SIZE;

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
  const moveSelectionSet = useMoveSelectionSet();
  const deleteSelectionSet = useDeleteSelectionSet();
  const createSelectionSetGroup = useCreateSelectionSetGroup();
  const renameSelectionSetGroup = useRenameSelectionSetGroup();
  const moveSelectionSetGroup = useMoveSelectionSetGroup();
  const deleteSelectionSetGroup = useDeleteSelectionSetGroup();
  const setDialog = useSetAtom(dialogAtom);
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
  const [focusedAddRow, setFocusedAddRow] = useState<AddRowTarget | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<
    ReadonlySet<SelectionSetGroupId>
  >(() => new Set());
  const [menuOpenGroupId, setMenuOpenGroupId] =
    useState<SelectionSetGroupId | null>(null);
  const [rowToReveal, setRowToReveal] = useState<{
    row: RowKey;
    groupId: SelectionSetGroupId | null;
  } | null>(null);
  const [pendingDraft, setPendingDraft] = useAtom(pendingCollectionDraftAtom);

  const {
    selectionSectionRows,
    groupRows,
    selectionRows,
    bookmarkRows,
    byNavId,
    addRowNavIds,
  } = useMemo(() => {
    let navId = 0;
    const setRow = (
      set: (typeof selectionSets)[number],
      depth: number,
      hidden: boolean,
      trailing: boolean[],
    ): Row => ({
      navId: ++navId,
      section: "selectionSets",
      id: set.id,
      label: set.label,
      kind: "set",
      depth,
      groupId: isGroupsOn ? set.groupId : null,
      hidden,
      trailing,
    });
    const selectionSectionRows: Row[] = [];
    const knownGroupIds = new Set(selectionSetGroups.map((group) => group.id));
    const walk = (
      parentId: SelectionSetGroupId | null,
      depth: number,
      hidden: boolean,
      parentTrailing: boolean[],
    ) => {
      const groups =
        parentId === null
          ? selectionSetGroups.filter(
              (group) =>
                group.parentId === null || !knownGroupIds.has(group.parentId),
            )
          : childGroups(selectionSetGroups, parentId);
      const setsOfParent =
        parentId === null
          ? []
          : selectionSets.filter((set) => set.groupId === parentId);
      for (const [index, group] of groups.entries()) {
        const inside = selectionSets.filter((set) => set.groupId === group.id);
        const trailing =
          parentId === null
            ? []
            : [
                ...parentTrailing,
                index === groups.length - 1 && setsOfParent.length === 0,
              ];
        const isEmpty =
          inside.length === 0 &&
          childGroups(selectionSetGroups, group.id).length === 0;
        selectionSectionRows.push({
          navId: ++navId,
          section: "selectionSets",
          id: group.id,
          label: group.label,
          kind: "group",
          depth,
          groupId: parentId,
          hidden,
          count: setsInGroupSubtree(selectionSetGroups, selectionSets, group.id)
            .length,
          addRowNavId: isEmpty ? ++navId : undefined,
          trailing,
        });
        const hiddenInside = hidden || collapsedGroupIds.has(group.id);
        walk(group.id, depth + 1, hiddenInside, trailing);
        for (const [setIndex, set] of inside.entries())
          selectionSectionRows.push(
            setRow(set, depth + 1, hiddenInside, [
              ...trailing,
              setIndex === inside.length - 1,
            ]),
          );
      }
    };
    if (isGroupsOn) walk(null, 0, false, []);
    for (const set of selectionSets) {
      if (isGroupsOn && set.groupId !== null && knownGroupIds.has(set.groupId))
        continue;
      selectionSectionRows.push(setRow(set, 0, false, []));
    }
    const groupRows = selectionSectionRows.filter(
      (row) => row.kind === "group",
    );
    const selectionRows = selectionSectionRows.filter(
      (row) => row.kind === "set",
    );
    const selectionSetsAddRowNavId =
      isGroupsOn && selectionSectionRows.length > 0 ? undefined : ++navId;
    const bookmarkRows: Row[] = bookmarks.map((bookmark) => ({
      navId: ++navId,
      section: "bookmarks",
      id: bookmark.id,
      label: bookmark.label,
      kind: "bookmark",
      depth: 0,
      groupId: null,
      hidden: false,
      trailing: [],
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
    return {
      selectionSectionRows,
      groupRows,
      selectionRows,
      bookmarkRows,
      byNavId,
      addRowNavIds,
    };
  }, [
    isGroupsOn,
    selectionSetGroups,
    selectionSets,
    bookmarks,
    collapsedGroupIds,
  ]);

  const isRowVisible = useCallback((row: Row) => !row.hidden, []);

  const addRowTargetOf = useCallback(
    (navId: number): AddRowTarget | undefined => {
      const section = SECTIONS.find(
        (section) => addRowNavIds[section] === navId,
      );
      if (section) return section;
      const group = groupRows.find((row) => row.addRowNavId === navId);
      return group ? { groupId: group.id } : undefined;
    },
    [addRowNavIds, groupRows],
  );

  const addRowNavIdOf = useCallback(
    (target: AddRowTarget): number | undefined =>
      typeof target === "string"
        ? addRowNavIds[target]
        : groupRows.find((row) => row.id === target.groupId)?.addRowNavId,
    [addRowNavIds, groupRows],
  );

  const navItems = useMemo(
    (): NavItem<SectionType>[] => [
      ...selectionSectionRows.filter(isRowVisible).flatMap((row) =>
        row.addRowNavId !== undefined && !collapsedGroupIds.has(row.id)
          ? [
              { id: row.navId, section: row.section },
              { id: row.addRowNavId, section: row.section },
            ]
          : [{ id: row.navId, section: row.section }],
      ),
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
    [
      selectionSectionRows,
      isRowVisible,
      collapsedGroupIds,
      bookmarkRows,
      addRowNavIds,
    ],
  );

  const focusedItem = useMemo((): NavItem<SectionType> | undefined => {
    if (focusedAddRow) {
      const navId = addRowNavIdOf(focusedAddRow);
      if (navId !== undefined)
        return {
          id: navId,
          section:
            typeof focusedAddRow === "string" ? focusedAddRow : "selectionSets",
        };
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
    addRowNavIdOf,
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

  const expandGroup = useCallback((groupId: SelectionSetGroupId) => {
    setCollapsedGroupIds((collapsed) => {
      if (!collapsed.has(groupId)) return collapsed;
      const next = new Set(collapsed);
      next.delete(groupId);
      return next;
    });
  }, []);

  const expandGroupPath = useCallback(
    (groupId: SelectionSetGroupId) => {
      const path = [groupId, ...ancestorGroupIds(selectionSetGroups, groupId)];
      setCollapsedGroupIds((collapsed) => {
        if (!path.some((id) => collapsed.has(id))) return collapsed;
        const next = new Set(collapsed);
        for (const id of path) next.delete(id);
        return next;
      });
    },
    [selectionSetGroups],
  );

  useEffect(() => {
    if (!rowToReveal) return;
    const rows = [...byNavId.values()];
    const scrollTo = (row: Row | undefined) =>
      row &&
      listRef.current
        ?.querySelector(`[data-item-id="${row.navId}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
    scrollTo(rows.find((candidate) => isSameRow(candidate, rowToReveal.row)));
    if (rowToReveal.groupId !== null)
      scrollTo(
        rows.find(
          (candidate) =>
            candidate.kind === "group" && candidate.id === rowToReveal.groupId,
        ),
      );
    setRowToReveal(null);
  }, [rowToReveal, byNavId]);

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

      const addRowTarget = addRowTargetOf(item.id);
      if (addRowTarget) {
        setFocusedSection(null);
        setFocusedRow(null);
        setFocusedAddRow(addRowTarget);
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
    [byNavId, addRowTargetOf, applySelectionSet],
  );

  const handleActivateItem = useCallback(
    (item: NavItem<SectionType>) => {
      if (item.id == null) return;

      const addRowTarget = addRowTargetOf(item.id);
      if (addRowTarget === "bookmarks") {
        startCollectionDraft({
          kind: "bookmarks",
          source: "collections-add-row",
          label: "",
        });
        return;
      }
      if (addRowTarget) {
        if (!canSaveSelection) return;
        startCollectionDraft({
          kind: "selectionSets",
          source: "collections-add-row",
          label: "",
          groupId:
            typeof addRowTarget === "string" ? null : addRowTarget.groupId,
        });
        return;
      }

      const row = byNavId.get(item.id);
      if (row) runRow(row);
    },
    [byNavId, addRowTargetOf, canSaveSelection, startCollectionDraft, runRow],
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

  const setHighlights = useSetAtom(highlightsAtom);
  useEffect(() => () => setHighlights([]), [setHighlights]);

  const handleHoverSet = (setId: SelectionSetId, isHovering: boolean) => {
    if (!isHovering) return setHighlights([]);
    const selectionSet = selectionSets.find((set) => set.id === setId);
    if (!selectionSet) return;

    const highlights: Highlight[] = [];
    for (const assetId of USelection.getAssetIds(selectionSet.selection)) {
      const asset = hydraulicModel.assets.get(assetId);
      if (!asset) continue;
      if (isNodeAsset(asset)) {
        const [lng, lat] = asset.coordinates;
        highlights.push({
          type: "marker",
          coordinates: [lng, lat],
          nodeType: asset.feature.properties.type,
        });
      } else {
        highlights.push({ type: "asset", assetId });
      }
    }
    setHighlights(highlights);
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

    if (actionState.action === "renamingGroup") {
      renameSelectionSetGroup({
        groupId: actionState.id,
        label: trimmedLabel,
        source: "panel",
      });
    } else if (actionState.action === "creatingGroup") {
      createSelectionSetGroup({
        label: trimmedLabel,
        parentId: actionState.parentId,
        source: "panel",
      });
    } else if (actionState.action === "creating") {
      if (actionState.section === "selectionSets") {
        saveSelectionSet({
          label: trimmedLabel,
          source: actionState.source,
          groupId: actionState.groupId,
        });
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

    const groupId = pendingDraft.groupId ?? null;
    setActionState({
      action: "creating",
      section: pendingDraft.kind,
      source: pendingDraft.source,
      label: pendingDraft.label,
      groupId,
    });
    if (groupId !== null) expandGroup(groupId);
    listRef.current?.openSection(pendingDraft.kind);
    setPendingDraft(null);
  }, [pendingDraft, setPendingDraft, expandGroup]);

  const handleNew = (section: SectionType, source: CollectionDraftSource) => {
    clearKeyboardFocus();
    startCollectionDraft({ kind: section, source, label: "" });
  };

  const handleNewGroup = (parentId: SelectionSetGroupId | null) => {
    clearKeyboardFocus();
    if (isLocked) return openPaywall();
    listRef.current?.openSection("selectionSets");
    if (parentId !== null) expandGroup(parentId);
    setActionState({ action: "creatingGroup", parentId });
  };

  const handleNewSetIn = (
    groupId: SelectionSetGroupId,
    source: CollectionDraftSource,
  ) => {
    clearKeyboardFocus();
    startCollectionDraft({ kind: "selectionSets", source, label: "", groupId });
  };

  const handleAction = (action: string, item: { id: number }) => {
    const row = byNavId.get(item.id);
    if (!row) return;

    if (isLocked) return openPaywall();

    if (action === "rename") {
      setActionState(
        row.kind === "group"
          ? { action: "renamingGroup", id: row.id }
          : { action: "renaming", section: row.section, id: row.id },
      );
      return;
    }

    if (action.startsWith(MOVE_ACTION_PREFIX)) {
      const target = action.slice(MOVE_ACTION_PREFIX.length);
      const targetId = target === "" ? null : target;
      if (row.kind === "group") {
        moveSelectionSetGroup({
          groupId: row.id,
          parentId: targetId,
          source: "panel",
        });
      } else {
        moveSelectionSet({ setId: row.id, groupId: targetId, source: "panel" });
      }
      if (targetId !== null) expandGroupPath(targetId);
      setRowToReveal({
        row: { section: row.section, id: row.id },
        groupId: targetId,
      });
      return;
    }

    clearActionState();
    setFocusedRow(null);
    if (row.kind === "group") {
      const setsInside = setsInGroupSubtree(
        selectionSetGroups,
        selectionSets,
        row.id,
      );
      if (setsInside.length === 0) {
        deleteSelectionSetGroup({ groupId: row.id, source: "panel" });
      } else {
        setDialog({
          type: "deleteSelectionSetGroupConfirmation",
          groupId: row.id,
        });
      }
    } else if (row.kind === "set") {
      deleteSelectionSet({ setId: row.id, source: "panel" });
    } else {
      deleteBookmark({ bookmarkId: row.id, source: "panel" });
    }
  };

  const renameAction: ItemAction = {
    action: "rename",
    label: translate("rename"),
    icon: <RenameIcon size="sm" />,
  };
  const deleteAction: ItemAction = {
    action: "delete",
    label: translate("delete"),
    icon: <CloseIcon size="sm" />,
    variant: "destructive",
  };

  const moveActionFor = (row: Row): ItemAction | null => {
    if (!isGroupsOn || row.kind === "bookmark") return null;
    const excluded = new Set(
      row.kind === "group"
        ? [row.id, ...descendantGroupIds(selectionSetGroups, row.id)]
        : [],
    );
    const targets: ItemAction[] = [
      ...(row.groupId !== null
        ? [
            {
              action: MOVE_ACTION_PREFIX,
              label: translate("collections.groups.topLevel"),
            },
          ]
        : []),
      ...groupRows
        .filter((group) => group.id !== row.groupId && !excluded.has(group.id))
        .map((group) => ({
          action: `${MOVE_ACTION_PREFIX}${group.id}`,
          label: groupPath(selectionSetGroups, group.id).join(" / "),
        })),
    ];
    if (targets.length === 0) return null;
    return {
      action: "move",
      label: translate("collections.selectionSets.moveTo"),
      icon: <FolderInputIcon size="sm" />,
      children: targets,
    };
  };

  const itemActionsFor = (row: Row): ItemAction[] => {
    const move = moveActionFor(row);
    return move
      ? [renameAction, move, deleteAction]
      : [renameAction, deleteAction];
  };

  const draftLabel =
    actionState?.action === "creating" ? actionState.label : "";
  const setDraftGroupId =
    actionState?.action === "creating" &&
    actionState.section === "selectionSets"
      ? actionState.groupId
      : undefined;

  const renderGroupRow = (row: Row) => {
    const isCollapsed = collapsedGroupIds.has(row.id);
    const isMenuOpen = menuOpenGroupId === row.id;
    const isRenaming =
      actionState?.action === "renamingGroup" && actionState.id === row.id;
    const guides = rowGuides(row.trailing, isCollapsed);
    const inputGuides = rowGuides(
      [...row.trailing, row.addRowNavId !== undefined],
      true,
    );
    return (
      <Fragment key={row.id}>
        {isRenaming ? (
          <ItemInput
            value={row.label}
            placeholder={translate("collections.groups.labelPlaceholder")}
            onCommit={handleLabelChange}
            onCancel={clearActionState}
            depth={row.depth}
            indentGuides={guides}
          />
        ) : (
          <li
            data-item-id={row.navId}
            style={
              row.depth > 0 ? { paddingLeft: `${row.depth}rem` } : undefined
            }
            className={clsx(
              "group relative flex items-center text-sm cursor-pointer h-8 min-w-0 rounded-sm",
              (focusedRow !== null && isSameRow(row, focusedRow)) || isMenuOpen
                ? "bg-base-hover"
                : "hover:bg-base-hover",
            )}
          >
            <IndentGuides guides={guides} />
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
              {row.count !== undefined && (
                <span className="shrink-0">({row.count})</span>
              )}
            </Button>
            <AddMenu
              label={translate("collections.groups.add")}
              isLocked={isLocked}
              onLockedClick={openPaywall}
              className={isMenuOpen ? "" : "invisible group-hover:visible"}
              items={[
                { action: "group", label: translate("collections.groups.new") },
                {
                  action: "set",
                  label: translate("collections.selectionSets.new"),
                  disabled: !canSaveSelection,
                },
              ]}
              onAction={(action) =>
                action === "group"
                  ? handleNewGroup(row.id)
                  : handleNewSetIn(row.id, "collections-group")
              }
              onOpenChange={(open) => setMenuOpenGroupId(open ? row.id : null)}
            />
            <ItemActions
              label={moreActionsLabel}
              isSelected={isMenuOpen}
              actions={itemActionsFor(row)}
              onAction={(action) => handleAction(action, { id: row.navId })}
              onOpenChange={(open) => setMenuOpenGroupId(open ? row.id : null)}
            />
          </li>
        )}
        {actionState?.action === "creatingGroup" &&
          actionState.parentId === row.id && (
            <ItemInput
              label={translate("collections.groups.newLabel")}
              value=""
              placeholder={translate("collections.groups.labelPlaceholder")}
              onCommit={handleLabelChange}
              onCancel={clearActionState}
              depth={row.depth + 1}
              indentGuides={inputGuides}
            />
          )}
        {setDraftGroupId === row.id && (
          <ItemInput
            label={translate("collections.selectionSets.newLabel")}
            value={draftLabel}
            forceValidation={draftLabel !== ""}
            placeholder={translate(
              "collections.selectionSets.labelPlaceholder",
            )}
            onCommit={handleLabelChange}
            onCancel={clearActionState}
            depth={row.depth + 1}
            indentGuides={inputGuides}
          />
        )}
        {!isCollapsed &&
          row.addRowNavId !== undefined &&
          !(
            actionState?.action === "creatingGroup" &&
            actionState.parentId === row.id
          ) &&
          setDraftGroupId !== row.id && (
            <CurrentStateRow
              label={
                canSaveSelection
                  ? translate("collections.selectionSets.saveCurrent")
                  : translate("collections.selectionSets.nothingSelected")
              }
              count={canSaveSelection ? selectedCount : undefined}
              navId={row.addRowNavId}
              depth={row.depth + 1}
              indentGuides={rowGuides([...row.trailing, true], true)}
              isFocused={
                typeof focusedAddRow === "object" &&
                focusedAddRow?.groupId === row.id
              }
              isDisabled={!canSaveSelection}
              isLocked={isLocked}
              onAdd={() => handleNewSetIn(row.id, "collections-add-row")}
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
      actions={itemActionsFor(row)}
      onAction={handleAction}
      depth={row.depth}
      indentGuides={rowGuides(row.trailing, true)}
      onHover={
        isHighlightOn && row.kind === "set"
          ? (isHovering) => handleHoverSet(row.id, isHovering)
          : undefined
      }
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
          showIndentGuide={isGroupsOn}
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
          {selectionSectionRows.map((row) =>
            !isRowVisible(row)
              ? null
              : row.kind === "group"
                ? renderGroupRow(row)
                : renderRow(row),
          )}
          {setDraftGroupId === null ? (
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
            addRowNavIds.selectionSets !== undefined &&
            actionState?.action !== "creatingGroup" && (
              <CurrentStateRow
                label={
                  canSaveSelection
                    ? translate("collections.selectionSets.saveCurrent")
                    : translate("collections.selectionSets.nothingSelected")
                }
                count={canSaveSelection ? selectedCount : undefined}
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
  depth = 0,
  indentGuides = [],
  isFocused,
  isDisabled = false,
  isLocked = false,
  onAdd,
}: {
  label: string;
  count?: number;
  navId: number;
  depth?: number;
  indentGuides?: readonly IndentGuide[];
  isFocused: boolean;
  isDisabled?: boolean;
  isLocked?: boolean;
  onAdd: () => void;
}) => (
  <li
    data-item-id={navId}
    style={depth > 0 ? { paddingLeft: `${depth}rem` } : undefined}
    className={clsx(
      "relative flex items-center text-sm h-8 min-w-0 rounded-sm",
      isFocused && "bg-base-hover",
      !isFocused && !isDisabled && "hover:bg-base-hover",
    )}
  >
    <IndentGuides guides={indentGuides} />
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
  onOpenChange,
  className,
}: {
  label: string;
  isLocked: boolean;
  onLockedClick: () => void;
  items: { action: string; label: string; disabled?: boolean }[];
  onAction: (action: string) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) => {
  const buttonClassName = clsx(
    "h-6 w-6 shrink-0 justify-center hover:bg-base-hover",
    className,
  );

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
      <DD.Root modal={false} onOpenChange={onOpenChange}>
        <DD.Trigger asChild>
          <Button
            variant="quiet"
            size="xxs"
            aria-label={label}
            className={`${buttonClassName} aria-expanded:bg-base-hover aria-expanded:visible`}
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
