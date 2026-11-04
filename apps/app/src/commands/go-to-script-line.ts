import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useActivatePanel } from "src/commands/activate-panel";
import { useUserTracking } from "src/infra/user-tracking";
import { SCRIPTS_PANEL_ID } from "src/panels/scripts/create-panel";
import { useScriptEditorRegistry } from "src/panels/scripts/script-editor-context";
import type { Dock } from "src/panels/docks";
import { splitsAtom, type Splits } from "src/state/layout";
import { placedPanelsAtom } from "src/state/panels";
import {
  isSameScript,
  scriptDraftAtom,
  userScriptsAtom,
  type ScriptDraft,
  type UserScript,
} from "src/state/scripts";

const OPEN_KEY: Partial<Record<Dock, keyof Splits>> = {
  left: "leftOpen",
  right: "rightOpen",
  bottom: "bottomOpen",
};

export const useGoToScriptLine = (
  runDraft: ScriptDraft,
): ((line: number) => void) | null => {
  const openDraft = useAtomValue(scriptDraftAtom);
  const scripts = useAtomValue(userScriptsAtom);
  const placedPanels = useAtomValue(placedPanelsAtom);
  const setDraft = useSetAtom(scriptDraftAtom);
  const editorRegistry = useScriptEditorRegistry();
  const setSplits = useSetAtom(splitsAtom);
  const activatePanel = useActivatePanel();
  const userTracking = useUserTracking();

  const dock = placedPanels.find((p) => p.id === SCRIPTS_PANEL_ID)?.dock;
  const goToLine = useCallback(
    (line: number) => {
      if (!dock || !editorRegistry) return;
      if (!openDraft) {
        const draftToOpen = draftToOpenFor(runDraft, scripts);
        if (!draftToOpen) return;
        setDraft(draftToOpen);
      }
      editorRegistry.revealLine(line);
      const openKey = OPEN_KEY[dock];
      if (openKey) {
        setSplits((splits) =>
          splits[openKey] ? splits : { ...splits, [openKey]: true },
        );
      }
      activatePanel(SCRIPTS_PANEL_ID);
      userTracking.capture({
        name: "script.errorLineOpened",
        openedScript: !openDraft,
      });
    },
    [
      dock,
      openDraft,
      runDraft,
      scripts,
      setDraft,
      editorRegistry,
      setSplits,
      activatePanel,
      userTracking,
    ],
  );

  if (!dock || !editorRegistry) return null;
  const canOpen = openDraft
    ? isSameScript(openDraft, runDraft)
    : draftToOpenFor(runDraft, scripts) !== null;
  return canOpen ? goToLine : null;
};

const draftToOpenFor = (
  runDraft: ScriptDraft,
  scripts: UserScript[],
): ScriptDraft | null => {
  if (runDraft.scriptId === null) return runDraft;
  const saved = scripts.find((script) => script.id === runDraft.scriptId);
  if (!saved) return null;
  return {
    scriptId: saved.id,
    exampleId: null,
    name: saved.name,
    source: saved.source,
    savedAs: { name: saved.name, source: saved.source },
  };
};
