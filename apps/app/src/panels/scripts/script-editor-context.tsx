import { createContext, useContext, useState, type ReactNode } from "react";

export type ScriptEditorHandle = {
  revealLine: (line: number) => void;
};

export class ScriptEditorRegistry {
  private editor: ScriptEditorHandle | null = null;
  private pendingLine: number | null = null;

  attach(editor: ScriptEditorHandle): () => void {
    this.editor = editor;
    const line = this.pendingLine;
    this.pendingLine = null;
    if (line !== null) editor.revealLine(line);
    return () => {
      if (this.editor === editor) this.editor = null;
    };
  }

  revealLine(line: number) {
    if (this.editor) this.editor.revealLine(line);
    else this.pendingLine = line;
  }
}

const ScriptEditorContext = createContext<ScriptEditorRegistry | null>(null);

export const ScriptEditorProvider = ({ children }: { children: ReactNode }) => {
  const [registry] = useState(() => new ScriptEditorRegistry());
  return (
    <ScriptEditorContext.Provider value={registry}>
      {children}
    </ScriptEditorContext.Provider>
  );
};

export const useScriptEditorRegistry = () => useContext(ScriptEditorContext);
