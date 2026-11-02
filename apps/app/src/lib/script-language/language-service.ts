import ts from "typescript";
import { renderDeclarations, scriptingDocs } from "@epanet-js/scripting-docs";
import { DEFAULT_LIB, typescriptLibs } from "./typescript-libs";

export type ScriptCompletionKind =
  | "class"
  | "constant"
  | "enum"
  | "function"
  | "interface"
  | "keyword"
  | "method"
  | "namespace"
  | "property"
  | "text"
  | "type"
  | "variable";

export type ScriptCompletion = {
  name: string;
  kind: ScriptCompletionKind;
  sortText: string;
};

export type ScriptCompletionDetails = {
  signature: string;
  documentation: string;
};

export type ScriptLanguageService = {
  completionsAt: (source: string, position: number) => ScriptCompletion[];
  completionDetails: (
    source: string,
    position: number,
    name: string,
  ) => ScriptCompletionDetails | null;
};

export const createScriptLanguageService = (): ScriptLanguageService => {
  const files = new Map<string, string>([
    ...Object.entries(typescriptLibs).map(
      ([name, content]): [string, string] => [`/${name}`, content],
    ),
    [DECLARATIONS_FILE, renderDeclarations(scriptingDocs)],
    [SCRIPT_FILE, ""],
  ]);
  let scriptVersion = 0;

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => COMPILER_OPTIONS,
    getScriptFileNames: () => [DECLARATIONS_FILE, SCRIPT_FILE],
    getScriptVersion: (fileName) =>
      fileName === SCRIPT_FILE ? String(scriptVersion) : "0",
    getScriptSnapshot: (fileName) => {
      const content = files.get(fileName);
      return content === undefined
        ? undefined
        : ts.ScriptSnapshot.fromString(content);
    },
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: () => `/${DEFAULT_LIB}`,
    fileExists: (fileName) => files.has(fileName),
    readFile: (fileName) => files.get(fileName),
  };
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  const updateSource = (source: string) => {
    if (files.get(SCRIPT_FILE) === source) return;
    files.set(SCRIPT_FILE, source);
    scriptVersion++;
  };

  return {
    completionsAt: (source, position) => {
      updateSource(source);
      const completions = service.getCompletionsAtPosition(
        SCRIPT_FILE,
        position,
        {},
      );
      if (!completions) return [];
      return completions.entries
        .filter((entry) => entry.kind !== ts.ScriptElementKind.warning)
        .map((entry) => ({
          name: entry.name,
          kind: completionKindOf(entry.kind),
          sortText: entry.sortText,
        }));
    },
    completionDetails: (source, position, name) => {
      updateSource(source);
      const details = service.getCompletionEntryDetails(
        SCRIPT_FILE,
        position,
        name,
        {},
        undefined,
        undefined,
        undefined,
      );
      if (!details) return null;
      return {
        signature: ts.displayPartsToString(details.displayParts),
        documentation: ts.displayPartsToString(details.documentation),
      };
    },
  };
};

const SCRIPT_FILE = "/script.js";
const DECLARATIONS_FILE = "/scripting.d.ts";

const COMPILER_OPTIONS: ts.CompilerOptions = {
  allowJs: true,
  checkJs: false,
  noEmit: true,
  strict: true,
  target: ts.ScriptTarget.ES2020,
  lib: [DEFAULT_LIB],
  types: [],
};

const completionKindOf = (kind: ts.ScriptElementKind): ScriptCompletionKind => {
  switch (kind) {
    case ts.ScriptElementKind.memberFunctionElement:
      return "method";
    case ts.ScriptElementKind.memberVariableElement:
    case ts.ScriptElementKind.memberGetAccessorElement:
    case ts.ScriptElementKind.memberSetAccessorElement:
      return "property";
    case ts.ScriptElementKind.functionElement:
    case ts.ScriptElementKind.localFunctionElement:
      return "function";
    case ts.ScriptElementKind.constElement:
      return "constant";
    case ts.ScriptElementKind.variableElement:
    case ts.ScriptElementKind.localVariableElement:
    case ts.ScriptElementKind.letElement:
    case ts.ScriptElementKind.parameterElement:
      return "variable";
    case ts.ScriptElementKind.keyword:
      return "keyword";
    case ts.ScriptElementKind.interfaceElement:
      return "interface";
    case ts.ScriptElementKind.typeElement:
      return "type";
    case ts.ScriptElementKind.classElement:
      return "class";
    case ts.ScriptElementKind.enumElement:
      return "enum";
    case ts.ScriptElementKind.moduleElement:
      return "namespace";
    default:
      return "text";
  }
};
