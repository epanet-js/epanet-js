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
import { useUserScripts } from "src/hooks/use-user-scripts";
import {
  AddIcon,
  ChevronLeftIcon,
  DeleteIcon,
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
  type ScriptDraft,
} from "src/state/scripts";
import { CodeEditor } from "./code-editor";

const UNTITLED = "Untitled script";

const NEW_SCRIPT_SOURCE = `// Writing this script with AI? Give your assistant this file first:
//   https://app.epanetjs.com/llms.txt
// It describes the whole scripting API, so the AI can write scripts
// that run here. If your AI can't open links, open it and paste it in.

// ---- inputs ----------------------------------------------------------
// Declare script inputs as constants here, where they are easy to edit.
// ----------------------------------------------------------------------

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
  run: { name: string; source: string; paywalled: boolean };
  scriptId: string | null;
};

const ScriptList = ({ onOpen }: { onOpen: (draft: ScriptDraft) => void }) => {
  const runScript = useRunScript();
  const { scripts, saveScript } = useUserScripts();
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
      run: { name: script.name, source: script.source, paywalled: true },
      draft: {
        scriptId: script.id,
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
        run: { name: example.name, source: example.source, paywalled: false },
        draft: {
          scriptId: null,
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
      name: UNTITLED,
      source: NEW_SCRIPT_SOURCE,
      savedAs: null,
    });
  }, [isEditLocked, openEditPaywall, onOpen]);

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
    label: "Edit",
    icon: <PencilIcon size="sm" />,
  };

  const itemActions: ItemAction[] = [
    editAction,
    {
      action: "rename",
      label: "Rename",
      icon: <RenameIcon size="sm" />,
    },
    {
      action: "delete",
      label: "Delete",
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
    stopRenaming();
    return false;
  };

  const renderRow = (row: Row) =>
    row.scriptId !== null && row.scriptId === renamingId ? (
      <ItemInput
        key={row.navId}
        label="Script name"
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
          label: `Run ${row.name}`,
          icon: <PlayIcon size="md" />,
          onClick: () => runScript(row.run, "list"),
        }}
        showFullLabelOnHover
        actions={row.scriptId ? itemActions : [editAction]}
        actionsLabel={`More actions for ${row.name}`}
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
          Automate work on your network and build the tools you&apos;re missing.
        </div>
        <CollapsibleListSection
          sectionType="myScripts"
          title="My scripts"
          count={myRows.length}
          isFocused={
            focusedItem?.section === "myScripts" && focusedItem.id == null
          }
          action={{ icon: <AddIcon />, label: "New script" }}
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
                  ? `${translate("paywall.tooltip")}: Create a script`
                  : undefined
              }
              className="flex-1 min-w-0 self-stretch justify-start hover:bg-transparent dark:hover:bg-transparent"
            >
              <span className="flex items-center gap-1 min-w-0 text-subtle">
                {isEditLocked ? <PaywallLockIcon size="sm" /> : <AddIcon />}
                <span className="truncate">Create a script</span>
              </span>
            </Button>
          </li>
        </CollapsibleListSection>
        <CollapsibleListSection
          sectionType="examples"
          title="Examples"
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
  const { saveScript } = useUserScripts();
  const setDialog = useSetAtom(dialogAtom);
  const { isLocked: isEditLocked, openPaywall: openEditPaywall } =
    useFeatureLock("editScripts");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const nameOf = (current: ScriptDraft) => current.name.trim() || UNTITLED;

  const handleRun = useCallback(
    (trigger: "editor" | "shortcut") =>
      runScript(
        {
          name: nameOf(draftRef.current),
          source: draftRef.current.source,
          paywalled: !isExample(draftRef.current),
        },
        trigger,
      ),
    [runScript],
  );

  const handleSave = useCallback(() => {
    if (isEditLocked) return openEditPaywall();
    const current = draftRef.current;
    const saved = saveScript({
      id: current.scriptId,
      name: isUnrenamedExample(current)
        ? `${nameOf(current)} (copy)`
        : nameOf(current),
      source: current.source,
    });
    onChange({
      scriptId: saved.id,
      name: saved.name,
      source: saved.source,
      savedAs: { name: saved.name, source: saved.source },
    });
    setConfirmingDiscard(false);
  }, [isEditLocked, openEditPaywall, saveScript, onChange]);

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
        <Button variant="quiet" aria-label="Back" onClick={handleBack}>
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
            label="Script name"
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
            aria-label="Run"
            title="Run"
            className="h-8"
            onClick={() => handleRun("editor")}
            disabled={isRunning}
          >
            <PlayIcon />
          </Button>
          <Button
            variant="quiet"
            aria-label="Save"
            title="Save"
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
                  aria-label="More actions"
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
                    Delete
                  </StyledItem>
                </DDContent>
              </DD.Portal>
            </DD.Root>
          )}
        </div>
      </div>
      {confirmingDiscard && (
        <div className="flex flex-col gap-2 px-3 py-2 border-b text-size-small">
          <span>
            You have unsaved changes. Are you sure you want to discard them?
          </span>
          <div className="flex items-center justify-end gap-2">
            <Button size="xs" onClick={() => setConfirmingDiscard(false)}>
              Keep editing
            </Button>
            <Button size="xs" variant="danger" onClick={onClose}>
              Discard changes
            </Button>
          </div>
        </div>
      )}
      {isExampleCopy && (
        <div className="px-3 py-1.5 border-b text-size-small text-subtle">
          This is an example. Saving keeps a copy under My scripts.
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
