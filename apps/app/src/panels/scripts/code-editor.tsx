import { useEffect, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { autocompletion } from "@codemirror/autocomplete";
import { placemarkTheme } from "src/lib/codemirror-theme";
import {
  scriptCompletionSource,
  warmUpScriptCompletions,
} from "./script-completions";

export function CodeEditor({
  initialSource,
  locked,
  onChange,
  onRun,
  onSave,
  onLockedEdit,
}: {
  initialSource: string;
  locked: boolean;
  onChange: (source: string) => void;
  onRun: () => void;
  onSave: () => void;
  onLockedEdit: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lockRef = useRef(new Compartment());
  const callbacksRef = useRef({ onChange, onRun, onSave, onLockedEdit });
  callbacksRef.current = { onChange, onRun, onSave, onLockedEdit };
  const initialSourceRef = useRef(initialSource);
  const initialLockedRef = useRef(locked);
  const onLockedEditRef = useRef(() => callbacksRef.current.onLockedEdit());

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;
    warmUpScriptCompletions();
    const view = new EditorView({
      state: EditorState.create({
        doc: initialSourceRef.current,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          indentOnInput(),
          indentUnit.of("  "),
          bracketMatching(),
          lockRef.current.of(
            lockExtension(initialLockedRef.current, onLockedEditRef.current),
          ),
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                callbacksRef.current.onRun();
                return true;
              },
            },
            {
              key: "Mod-s",
              run: () => {
                callbacksRef.current.onSave();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          javascript(),
          autocompletion({ override: [scriptCompletionSource] }),
          placemarkTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              callbacksRef.current.onChange(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent,
    });
    viewRef.current = view;
    view.focus();
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: lockRef.current.reconfigure(
        lockExtension(locked, onLockedEditRef.current),
      ),
    });
  }, [locked]);

  return <div ref={containerRef} className="h-full [&_.cm-editor]:h-full!" />;
}

const lockExtension = (
  isLocked: boolean,
  onLockedEdit: () => void,
): Extension => {
  if (!isLocked) return [];
  const blockEdit = (event: Event) => {
    event.preventDefault();
    onLockedEdit();
    return true;
  };
  return [
    EditorState.readOnly.of(true),
    EditorView.domEventHandlers({
      beforeinput: blockEdit,
      paste: blockEdit,
      drop: blockEdit,
    }),
  ];
};
