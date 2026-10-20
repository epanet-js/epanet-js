import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
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
import { placemarkTheme } from "src/lib/codemirror-theme";

export function CodeEditor({
  initialSource,
  onChange,
  onRun,
  onSave,
}: {
  initialSource: string;
  onChange: (source: string) => void;
  onRun: () => void;
  onSave: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onChange, onRun, onSave });
  callbacksRef.current = { onChange, onRun, onSave };
  const initialSourceRef = useRef(initialSource);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;
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
    view.focus();
    return () => view.destroy();
  }, []);

  return <div ref={containerRef} className="h-full [&_.cm-editor]:h-full!" />;
}
