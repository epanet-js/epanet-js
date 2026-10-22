import { useAtom, useAtomValue } from "jotai";
import { useCallback, useRef, useState } from "react";
import { Button } from "src/components/elements";
import { EditableTextField } from "src/components/form/editable-text-field";
import { useRunScript } from "src/commands/run-script";
import { useUserScripts } from "src/hooks/use-user-scripts";
import {
  AddIcon,
  ChevronLeftIcon,
  CloseIcon,
  DeleteIcon,
  PlayIcon,
  SaveIcon,
} from "src/icons";
import { getScripting } from "src/lib/scripting";
import {
  hasUnsavedChanges,
  scriptDraftAtom,
  scriptRunAtom,
  type ScriptDraft,
} from "src/state/scripts";
import { CodeEditor } from "./code-editor";
import { RowAction } from "./row-action";

const UNTITLED = "Untitled script";

const NEW_SCRIPT_SOURCE = `// ---- inputs ----------------------------------------------------------
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

const ScriptList = ({ onOpen }: { onOpen: (draft: ScriptDraft) => void }) => {
  const runScript = useRunScript();
  const isRunning = useIsRunning();
  const { scripts, deleteScript } = useUserScripts();

  return (
    <div className="h-full flex flex-col overflow-y-auto placemark-scrollbar">
      <div className="py-2 px-4 text-size-base font-bold text-default border-b w-full flex items-center justify-between gap-2">
        <span>Scripts</span>
        <Button
          variant="quiet"
          size="xs"
          onClick={() =>
            onOpen({
              scriptId: null,
              name: UNTITLED,
              source: NEW_SCRIPT_SOURCE,
              savedAs: null,
            })
          }
        >
          <AddIcon size="sm" />
          New
        </Button>
      </div>
      <div className="px-4 py-2 text-size-base">
        Read the network and hand results back as a selection, files and console
        output.
      </div>
      <div className="relative flex-auto px-1 pb-2">
        <SectionTitle>My scripts</SectionTitle>
        {scripts.length === 0 && (
          <div className="px-3 py-2 text-size-small text-subtle">
            No scripts yet. Create one, or open an example and save a copy.
          </div>
        )}
        {scripts.map((script) => (
          <ScriptRow
            key={script.id}
            name={script.name}
            detail={new Date(script.updatedAt).toLocaleDateString()}
            runDisabled={isRunning}
            onOpen={() =>
              onOpen({
                scriptId: script.id,
                name: script.name,
                source: script.source,
                savedAs: { name: script.name, source: script.source },
              })
            }
            onRun={() => runScript(script)}
            onDelete={() => deleteScript(script.id)}
          />
        ))}
        <SectionTitle>Examples</SectionTitle>
        {(getScripting()?.exampleScripts ?? []).map((example) => (
          <ScriptRow
            key={example.id}
            name={example.name}
            runDisabled={isRunning}
            onOpen={() =>
              onOpen({
                scriptId: null,
                name: example.name,
                source: example.source,
                savedAs: { name: example.name, source: example.source },
              })
            }
            onRun={() => runScript(example)}
          />
        ))}
      </div>
    </div>
  );
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 pt-3 pb-1 text-size-small font-semibold uppercase text-subtle">
    {children}
  </div>
);

const ScriptRow = ({
  name,
  detail,
  runDisabled,
  onOpen,
  onRun,
  onDelete,
}: {
  name: string;
  detail?: string;
  runDisabled: boolean;
  onOpen: () => void;
  onRun: () => void;
  onDelete?: () => void;
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Button
      onClick={onOpen}
      variant="quiet/list"
      aria-label={name}
      className="group w-full"
    >
      <div className="grid grid-cols-[1fr_auto] gap-x-1 items-center p-2 text-size-base w-full">
        <div className="min-w-0 text-left">
          <div className="text-size-base font-semibold truncate">{name}</div>
          {detail && (
            <div className="text-size-small text-subtle truncate">{detail}</div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {confirmingDelete && onDelete ? (
            <>
              <RowAction label="Delete" onActivate={onDelete}>
                <span className="text-error text-size-small font-semibold whitespace-nowrap">
                  Delete
                </span>
              </RowAction>
              <RowAction
                label="Keep script"
                onActivate={() => setConfirmingDelete(false)}
              >
                <CloseIcon size="sm" />
              </RowAction>
            </>
          ) : (
            <>
              <RowAction
                label={`Run ${name}`}
                onActivate={onRun}
                disabled={runDisabled}
                disabledReason="A script is already running"
              >
                <PlayIcon size="sm" />
              </RowAction>
              {onDelete && (
                <RowAction
                  label={`Delete ${name}`}
                  onActivate={() => setConfirmingDelete(true)}
                >
                  <DeleteIcon size="sm" />
                </RowAction>
              )}
            </>
          )}
        </div>
      </div>
    </Button>
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
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const nameOf = (current: ScriptDraft) => current.name.trim() || UNTITLED;

  const handleRun = useCallback(
    () =>
      runScript({
        name: nameOf(draftRef.current),
        source: draftRef.current.source,
      }),
    [runScript],
  );

  const handleSave = useCallback(() => {
    const current = draftRef.current;
    const saved = saveScript({
      id: current.scriptId,
      name: nameOf(current),
      source: current.source,
    });
    onChange({
      scriptId: saved.id,
      name: saved.name,
      source: saved.source,
      savedAs: { name: saved.name, source: saved.source },
    });
    setConfirmingDiscard(false);
  }, [saveScript, onChange]);

  const handleBack = () => {
    if (hasUnsavedChanges(draft) && !confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  };

  const isExampleCopy = draft.scriptId === null && draft.savedAs !== null;

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-1 px-2 py-2 border-b">
        <Button variant="quiet" aria-label="Back" onClick={handleBack}>
          <ChevronLeftIcon />
        </Button>
        <EditableTextField
          label="Script name"
          value={draft.name}
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
        <Button
          variant="quiet"
          aria-label="Save"
          title="Save"
          className="ml-auto"
          onClick={handleSave}
          disabled={
            !isRenaming && !hasUnsavedChanges(draft) && draft.scriptId !== null
          }
        >
          <SaveIcon />
        </Button>
      </div>
      {confirmingDiscard && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-warning-subtle text-warning text-size-small">
          <span>Discard unsaved changes?</span>
          <div className="flex items-center gap-1">
            <Button size="xs" onClick={onClose}>
              Discard
            </Button>
            <Button
              size="xs"
              variant="quiet"
              onClick={() => setConfirmingDiscard(false)}
            >
              Keep editing
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
          onChange={(source) => onChange({ ...draftRef.current, source })}
          onRun={handleRun}
          onSave={handleSave}
        />
      </div>
      <div className="flex items-center justify-end gap-2 p-2 border-t">
        <Button
          variant="primary"
          size="sm"
          onClick={handleRun}
          disabled={isRunning}
        >
          <PlayIcon size="sm" />
          Run
        </Button>
      </div>
    </div>
  );
};

const useIsRunning = () => useAtomValue(scriptRunAtom)?.status === "running";
