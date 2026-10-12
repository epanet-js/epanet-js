import { useAtom, useAtomValue } from "jotai";
import { useCallback, useRef } from "react";
import { Button } from "src/components/elements";
import { useRunScript } from "src/commands/run-script";
import { ChevronLeftIcon, PlayIcon } from "src/icons";
import { getScripting } from "src/lib/scripting";
import {
  scriptDraftAtom,
  scriptRunAtom,
  type ScriptDraft,
} from "src/state/scripts";
import { CodeEditor } from "./code-editor";

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

  return (
    <div className="h-full flex flex-col overflow-y-auto placemark-scrollbar">
      <div className="py-2 px-4 text-size-base font-bold text-default border-b">
        Scripts
      </div>
      <div className="px-4 py-2 text-size-base text-subtle">
        Read the network and hand results back as a selection, files and console
        output.
      </div>
      <div className="px-3 pt-3 pb-1 text-size-small font-semibold uppercase text-subtle">
        Examples
      </div>
      <div className="px-1 pb-2">
        {(getScripting()?.exampleScripts ?? []).map((example) => (
          <div
            key={example.id}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-panel-hover"
          >
            <button
              type="button"
              className="flex-auto min-w-0 text-left text-size-base font-semibold truncate"
              onClick={() =>
                onOpen({ name: example.name, source: example.source })
              }
            >
              {example.name}
            </button>
            <Button
              variant="quiet"
              size="xs"
              aria-label={`Run ${example.name}`}
              disabled={isRunning}
              onClick={() =>
                runScript({ name: example.name, source: example.source })
              }
            >
              <PlayIcon size="sm" />
            </Button>
          </div>
        ))}
      </div>
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
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const handleRun = useCallback(() => runScript(draftRef.current), [runScript]);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-1 px-2 py-2 border-b">
        <Button variant="quiet" aria-label="Back" onClick={onClose}>
          <ChevronLeftIcon />
        </Button>
        <span className="flex-auto min-w-0 truncate text-size-base font-semibold">
          {draft.name}
        </span>
      </div>
      <div className="flex-auto min-h-0">
        <CodeEditor
          initialSource={draft.source}
          onChange={(source) => onChange({ ...draftRef.current, source })}
          onRun={handleRun}
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
