import ts from "typescript";
import { resultsCandidateDocs, scriptingDocs } from "../definition";
import type { ScriptingDocs } from "../types";
import { renderDeclarations } from "./declarations";

describe.each<[string, ScriptingDocs]>([
  ["scriptingDocs", scriptingDocs],
  ["resultsCandidateDocs", resultsCandidateDocs],
])("renderDeclarations(%s)", (_name, docs) => {
  it("compiles against the ES2020 library with no errors", () => {
    const fileName = "/scripting.d.ts";
    const source = renderDeclarations(docs);
    const options: ts.CompilerOptions = {
      noEmit: true,
      strict: true,
      lib: ["lib.es2020.d.ts"],
      types: [],
    };
    const host = ts.createCompilerHost(options);
    host.readFile = (name) =>
      name === fileName ? source : ts.sys.readFile(name);
    host.fileExists = (name) => name === fileName || ts.sys.fileExists(name);

    const program = ts.createProgram([fileName], options, host);
    const errors = ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );

    expect(errors).toEqual([]);
  });

  it("declares every global", () => {
    const source = renderDeclarations(docs);

    const missing = docs.globals.filter(
      (global) =>
        !source.includes(`declare const ${global.name}: ${global.type};`),
    );

    expect(missing.map((global) => global.name)).toEqual([]);
  });
});
