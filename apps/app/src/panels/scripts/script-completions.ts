import type {
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";
import { canUseWorker } from "src/infra/worker";
import {
  getScriptLanguageWorker,
  type ScriptCompletion,
} from "src/lib/script-language";

export const scriptCompletionSource = async (
  context: CompletionContext,
): Promise<CompletionResult | null> => {
  const word = context.matchBefore(/[\w$]*/);
  const from = word ? word.from : context.pos;
  const isAfterDot = context.state.sliceDoc(from - 1, from) === ".";
  if (!canUseWorker()) return null;
  if (!context.explicit && from === context.pos && !isAfterDot) return null;

  const source = context.state.doc.toString();
  const worker = getScriptLanguageWorker();
  const completions = await worker.completionsAt(source, context.pos);
  if (context.aborted) return null;

  return {
    from,
    validFor: /^[\w$]*$/,
    options: completions.map((completion) =>
      toOption(completion, () =>
        worker.completionDetails(source, context.pos, completion.name),
      ),
    ),
  };
};

export const warmUpScriptCompletions = (): void => {
  if (!canUseWorker()) return;
  void getScriptLanguageWorker().completionsAt("", 0);
};

const toOption = (
  completion: ScriptCompletion,
  loadDetails: () => Promise<{
    signature: string;
    documentation: string;
  } | null>,
): Completion => ({
  label: completion.name,
  type: completion.kind,
  boost: boostOf(completion.sortText),
  info: async () => {
    const details = await loadDetails();
    if (!details) return null;
    const container = document.createElement("div");
    container.className = "max-w-80 text-xs";
    const signature = document.createElement("code");
    signature.className = "block font-mono whitespace-pre-wrap";
    signature.textContent = details.signature;
    container.appendChild(signature);
    if (details.documentation) {
      const documentation = document.createElement("p");
      documentation.className = "mt-1 whitespace-pre-wrap";
      documentation.textContent = details.documentation;
      container.appendChild(documentation);
    }
    return container;
  },
});

const boostOf = (sortText: string): number => {
  const rank = Number(sortText);
  return Number.isFinite(rank) ? -rank : 0;
};
