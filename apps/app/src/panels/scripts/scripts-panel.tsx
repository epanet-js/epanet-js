import * as DD from "@radix-ui/react-dropdown-menu";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import clsx from "clsx";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button, DDContent, StyledItem } from "src/components/elements";
import { EditableTextField } from "src/components/form/editable-text-field";
import {
  CollapsibleListSection,
  ItemInput,
  ListItem,
  NavigableList,
} from "src/components/list";
import type {
  ItemAction,
  NavItem,
  NavigableListHandle,
} from "src/components/list";
import { useRunScript } from "src/commands/run-script";
import { useFeatureLock } from "src/components/form/paywall";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useScriptsTransaction } from "src/hooks/persistence/use-scripts-transaction";
import {
  AddIcon,
  ChevronLeftIcon,
  DeleteIcon,
  DocsIcon,
  MoreActionsIcon,
  PaywallLockIcon,
  PencilIcon,
  PlayIcon,
  RenameIcon,
  SaveIcon,
} from "src/icons";
import { getScripting } from "src/lib/scripting";
import { dialogAtom } from "src/state/dialog";
import {
  hasUnsavedChanges,
  scriptDraftAtom,
  scriptRunAtom,
  userScriptsAtom,
  type ScriptDraft,
} from "src/state/scripts";
import { CodeEditor } from "./code-editor";

const NEW_SCRIPT_SOURCE = `// Writing this script with AI? Give your assistant this file first:
//   https://app.epanetjs.com/llms.txt
// It describes the whole scripting API, so the AI can write scripts
// that run here. If your AI can't open links, open it and paste it in.

console.log("Junctions:", network.stats.junctions, "· Pipes:", network.stats.pipes);
`;

export const ScriptsPanel = () => {
  const [draft, setDraft] = useAtom(scriptDraftAtom);

  if (draft) {
    return (
      <ScriptEditor
        draft={draft}
        onChange={setDraft}
        onClose={() => setDraft(null)}
      />
    );
  }
  return <ScriptList onOpen={setDraft} />;
};

type Section = "myScripts" | "examples";

type Row = {
  navId: number;
  section: Section;
  name: string;
  draft: ScriptDraft;
  run: {
    name: string;
    source: string;
    paywalled: boolean;
    exampleId: string | null;
  };
  scriptId: string | null;
};

const ScriptList = ({ onOpen }: { onOpen: (draft: ScriptDraft) => void }) => {
  const runScript = useRunScript();
  const scripts = useAtomValue(userScriptsAtom);
  const { save: saveScript } = useScriptsTransaction();
  const userTracking = useUserTracking();
  const setDialog = useSetAtom(dialogAtom);
  const translate = useTranslate();
  const { isLocked: isEditLocked, openPaywall: openEditPaywall } =
    useFeatureLock("editScripts");
  const listRef = useRef<NavigableListHandle>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [focusedItem, setFocusedItem] = useState<NavItem<Section> | undefined>(
    undefined,
  );

  const { myRows, exampleRows, newRowNavId, byNavId } = useMemo(() => {
    const myRows: Row[] = scripts.map((script, index) => ({
      navId: index + 1,
      section: "myScripts",
      name: script.name,
      scriptId: script.id,
      run: {
        name: script.name,
        source: script.source,
        paywalled: true,
        exampleId: null,
      },
      draft: {
        scriptId: script.id,
        exampleId: null,
        name: script.name,
        source: script.source,
        savedAs: { name: script.name, source: script.source },
      },
    }));
    const newRowNavId = scripts.length + 1;
    const exampleRows: Row[] = (getScripting()?.exampleScripts ?? []).map(
      (example, index) => ({
        navId: newRowNavId + index + 1,
        section: "examples",
        name: example.name,
        scriptId: null,
        run: {
          name: example.name,
          source: example.source,
          paywalled: false,
          exampleId: example.id,
        },
        draft: {
          scriptId: null,
          exampleId: example.id,
          name: example.name,
          source: example.source,
          savedAs: { name: example.name, source: example.source },
        },
      }),
    );
    const byNavId = new Map<number, Row>(
      [...myRows, ...exampleRows].map((row) => [row.navId, row]),
    );
    return { myRows, exampleRows, newRowNavId, byNavId };
  }, [scripts]);

  const navItems = useMemo(
    (): NavItem<Section>[] => [
      ...myRows.map((row) => ({ id: row.navId, section: row.section })),
      { id: newRowNavId, section: "myScripts" },
      ...exampleRows.map((row) => ({ id: row.navId, section: row.section })),
    ],
    [myRows, exampleRows, newRowNavId],
  );

  const openNew = useCallback(() => {
    if (isEditLocked) return openEditPaywall();
    onOpen({
      scriptId: null,
      exampleId: null,
      name: translate("scripting.untitled"),
      source: NEW_SCRIPT_SOURCE,
      savedAs: null,
    });
  }, [isEditLocked, openEditPaywall, onOpen, translate]);

  const handleActivateItem = useCallback(
    (item: NavItem<Section>) => {
      if (item.id === newRowNavId) return openNew();
      const row = item.id != null ? byNavId.get(item.id) : undefined;
      if (row) onOpen(row.draft);
    },
    [byNavId, newRowNavId, onOpen, openNew],
  );

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setFocusedItem(undefined);
  };

  const handleAction = (action: string, item: { id: number }) => {
    const row = byNavId.get(item.id);
    if (!row) return;
    if (action === "edit") return onOpen(row.draft);
    if (isEditLocked) return openEditPaywall();
    if (action === "rename" && row.scriptId) {
      setRenamingId(row.scriptId);
      return;
    }
    if (action === "delete" && row.scriptId) {
      setFocusedItem(undefined);
      setDialog({
        type: "deleteScriptConfirmation",
        scriptId: row.scriptId,
        scriptName: row.name,
      });
    }
  };

  const editAction: ItemAction = {
    action: "edit",
    label: translate("scripting.edit"),
    icon: <PencilIcon size="sm" />,
  };

  const itemActions: ItemAction[] = [
    editAction,
    {
      action: "rename",
      label: translate("rename"),
      icon: <RenameIcon size="sm" />,
    },
    {
      action: "delete",
      label: translate("delete"),
      icon: <DeleteIcon size="sm" />,
      variant: "destructive",
    },
  ];

  const stopRenaming = () => {
    setRenamingId(null);
    requestAnimationFrame(() => listRef.current?.focus());
  };

  const handleRename = (row: Row, name: string): boolean => {
    const trimmedName = name.trim();
    if (!trimmedName) return true;
    saveScript({
      id: row.scriptId,
      name: trimmedName,
      source: row.run.source,
    });
    userTracking.capture({
      name: "script.saved",
      kind: "update",
      source: "list",
      scriptsCount: scripts.length,
    });
    stopRenaming();
    return false;
  };

  const renderRow = (row: Row) =>
    row.scriptId !== null && row.scriptId === renamingId ? (
      <ItemInput
        key={row.navId}
        label={translate("scripting.scriptName")}
        value={row.name}
        onCommit={(name) => handleRename(row, name)}
        onCancel={stopRenaming}
      />
    ) : (
      <ListItem
        key={row.navId}
        item={{ id: row.navId, label: row.name }}
        isSelected={false}
        isFocused={focusedItem?.id === row.navId}
        onSelect={() => onOpen(row.draft)}
        secondaryAction={{
          label: translate("scripting.runScript", row.name),
          icon: <PlayIcon size="md" />,
          onClick: () => runScript(row.run, "list"),
        }}
        showFullLabelOnHover
        actions={row.scriptId ? itemActions : [editAction]}
        actionsLabel={translate("scripting.moreActionsFor", row.name)}
        onAction={handleAction}
      />
    );

  return (
    <div className="flex flex-col h-full" onBlur={handleBlur}>
      <NavigableList
        ref={listRef}
        isNavBlocked={renamingId !== null}
        navItems={navItems}
        focusedItem={focusedItem}
        onSelectItem={setFocusedItem}
        onActivateItem={handleActivateItem}
      >
        <div className="px-1 pb-2 text-size-base">
          {translate("scripting.description")}
        </div>
        <CollapsibleListSection
          sectionType="myScripts"
          title={translate("scripting.myScripts")}
          count={myRows.length}
          isFocused={
            focusedItem?.section === "myScripts" && focusedItem.id == null
          }
          action={{
            icon: <AddIcon />,
            label: translate("scripting.newScript"),
          }}
          onAction={openNew}
        >
          {myRows.map(renderRow)}
          <li
            data-item-id={newRowNavId}
            className={clsx(
              "flex items-center text-sm h-8 min-w-0 rounded-sm",
              focusedItem?.id === newRowNavId
                ? "bg-base-hover"
                : "hover:bg-base-hover",
            )}
          >
            <Button
              variant="quiet/list"
              size="sm"
              onClick={openNew}
              aria-label={
                isEditLocked
                  ? `${translate("paywall.tooltip")}: ${translate("scripting.createScript")}`
                  : undefined
              }
              className="flex-1 min-w-0 self-stretch justify-start hover:bg-transparent dark:hover:bg-transparent"
            >
              <span className="flex items-center gap-1 min-w-0 text-subtle">
                {isEditLocked ? <PaywallLockIcon size="sm" /> : <AddIcon />}
                <span className="truncate">
                  {translate("scripting.createScript")}
                </span>
              </span>
            </Button>
          </li>
        </CollapsibleListSection>
        <CollapsibleListSection
          sectionType="examples"
          title={translate("scripting.examples")}
          count={exampleRows.length}
          isFocused={
            focusedItem?.section === "examples" && focusedItem.id == null
          }
        >
          {exampleRows.map(renderRow)}
        </CollapsibleListSection>
      </NavigableList>
    </div>
  );
};

const ScriptEditor = ({
  draft,
  onChange,
  onClose,
}: {
  draft: ScriptDraft;
  onChange: (draft: ScriptDraft) => void;
  onClose: () => void;
}) => {
  const runScript = useRunScript();
  const isRunning = useIsRunning();
  const scripts = useAtomValue(userScriptsAtom);
  const { save: saveScript } = useScriptsTransaction();
  const userTracking = useUserTracking();
  const setDialog = useSetAtom(dialogAtom);
  const translate = useTranslate();
  const { isLocked: isEditLocked, openPaywall: openEditPaywall } =
    useFeatureLock("editScripts");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const nameOf = useCallback(
    (current: ScriptDraft) =>
      current.name.trim() || translate("scripting.untitled"),
    [translate],
  );

  const handleRun = useCallback(
    (trigger: "editor" | "shortcut") =>
      runScript(
        {
          name: nameOf(draftRef.current),
          source: draftRef.current.source,
          paywalled: !isExample(draftRef.current),
          exampleId: draftRef.current.exampleId,
        },
        trigger,
      ),
    [runScript, nameOf],
  );

  const handleSave = useCallback(() => {
    if (isEditLocked) return openEditPaywall();
    const current = draftRef.current;
    const saved = saveScript({
      id: current.scriptId,
      name: isUnrenamedExample(current)
        ? translate("scripting.copyName", nameOf(current))
        : nameOf(current),
      source: current.source,
    });
    if (!saved) return;
    onChange({
      scriptId: saved.id,
      exampleId: null,
      name: saved.name,
      source: saved.source,
      savedAs: { name: saved.name, source: saved.source },
    });
    const kind =
      current.scriptId !== null
        ? "update"
        : current.exampleId !== null
          ? "exampleCopy"
          : "new";
    userTracking.capture({
      name: "script.saved",
      kind,
      source: "editor",
      scriptsCount: kind === "update" ? scripts.length : scripts.length + 1,
    });
    setConfirmingDiscard(false);
  }, [
    isEditLocked,
    openEditPaywall,
    saveScript,
    onChange,
    nameOf,
    translate,
    userTracking,
    scripts.length,
  ]);

  const handleBack = () => {
    if (hasUnsavedChanges(draft) && !confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  };

  const isExampleCopy = isExample(draft);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-1 px-2 py-2 border-b">
        <Button
          variant="quiet"
          aria-label={translate("back")}
          onClick={handleBack}
        >
          <ChevronLeftIcon />
        </Button>
        {isEditLocked ? (
          <button
            type="button"
            title={draft.name}
            onClick={openEditPaywall}
            className="min-w-0 truncate px-1 text-sm font-semibold text-left"
          >
            {draft.name}
          </button>
        ) : (
          <EditableTextField
            label={translate("scripting.scriptName")}
            value={draft.name}
            title={draft.name}
            onChangeValue={(name) => {
              onChange({ ...draftRef.current, name });
              setIsRenaming(false);
              return false;
            }}
            onDirty={() => setIsRenaming(true)}
            onReset={() => setIsRenaming(false)}
            className="min-w-0"
            styleOptions={{
              padding: "sm",
              ghostBorder: true,
              fontWeight: "semibold",
              textSize: "sm",
              width: "content",
            }}
          />
        )}
        <div className="flex shrink-0 ml-auto">
          <Button
            variant="quiet"
            aria-label={translate("scripting.run")}
            title={translate("scripting.run")}
            className="h-8"
            onClick={() => handleRun("editor")}
            disabled={isRunning}
          >
            <PlayIcon />
          </Button>
          <Button
            variant="quiet"
            aria-label={translate("save")}
            title={translate("save")}
            className="h-8"
            onClick={handleSave}
            disabled={
              !isEditLocked &&
              !isRenaming &&
              !hasUnsavedChanges(draft) &&
              draft.scriptId !== null
            }
          >
            <SaveIcon />
          </Button>
          {draft.scriptId !== null && (
            <DD.Root modal={false}>
              <DD.Trigger asChild>
                <Button
                  variant="quiet"
                  aria-label={translate("moreActions")}
                  className="h-8"
                >
                  <MoreActionsIcon />
                </Button>
              </DD.Trigger>
              <DD.Portal>
                <DDContent align="end" side="bottom" className="z-50">
                  <StyledItem
                    variant="destructive"
                    onSelect={() => {
                      if (isEditLocked) return openEditPaywall();
                      if (draft.scriptId === null) return;
                      setDialog({
                        type: "deleteScriptConfirmation",
                        scriptId: draft.scriptId,
                        scriptName: draft.name,
                      });
                    }}
                  >
                    <DeleteIcon size="sm" />
                    {translate("delete")}
                  </StyledItem>
                </DDContent>
              </DD.Portal>
            </DD.Root>
          )}
          <Button
            variant="quiet"
            aria-label={translate("scripting.apiReference")}
            title={translate("scripting.apiReference")}
            className="h-8"
            onClick={() => {
              userTracking.capture({
                name: "scriptingApi.visited",
                source: "editor",
              });
              window.open("/scripting-api", "_blank", "noopener,noreferrer");
            }}
          >
            <DocsIcon />
          </Button>
        </div>
      </div>
      {confirmingDiscard && (
        <div className="flex flex-col gap-2 px-3 py-2 border-b text-size-small">
          <span>{translate("scripting.unsavedChanges")}</span>
          <div className="flex items-center justify-end gap-2">
            <Button size="xs" onClick={() => setConfirmingDiscard(false)}>
              {translate("dialog.keepEditing")}
            </Button>
            <Button size="xs" variant="danger" onClick={onClose}>
              {translate("dialog.discardChanges")}
            </Button>
          </div>
        </div>
      )}
      {isExampleCopy && (
        <div className="px-3 py-1.5 border-b text-size-small text-subtle">
          {translate("scripting.exampleCopyHint")}
        </div>
      )}
      <div className="flex-auto min-h-0">
        <CodeEditor
          initialSource={draft.source}
          locked={isEditLocked}
          onChange={(source) => onChange({ ...draftRef.current, source })}
          onRun={() => handleRun("shortcut")}
          onSave={handleSave}
          onLockedEdit={openEditPaywall}
        />
      </div>
    </div>
  );
};

const isExample = (draft: ScriptDraft) =>
  draft.scriptId === null && draft.savedAs !== null;

const isUnrenamedExample = (draft: ScriptDraft) =>
  draft.scriptId === null &&
  draft.savedAs !== null &&
  draft.name === draft.savedAs.name;

const useIsRunning = () => useAtomValue(scriptRunAtom)?.status === "running";
