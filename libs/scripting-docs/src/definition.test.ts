import { SCRIPT_API_VERSION } from "./api-version";
import { editsCandidateDocs, scriptingDocs } from "./definition";
import { renderLlmsTxt } from "./render/markdown";
import { callForm, parseSignature } from "./signature";
import type { ScriptingDocs } from "./types";

describe.each<[string, ScriptingDocs]>([
  ["scriptingDocs", scriptingDocs],
  ["editsCandidateDocs", editsCandidateDocs],
])("%s", (_name, docs) => {
  const members = docs.sections.flatMap((section) => section.members ?? []);
  const pathOf = (owner: string) =>
    docs.interfaces.find((iface) => iface.name === owner)?.path;

  it("documents members of declared interfaces only", () => {
    const undeclared = members.filter((member) => !pathOf(member.owner));

    expect(undeclared.map((member) => member.owner)).toEqual([]);
  });

  it("names each member as its signature does", () => {
    const mismatched = members.filter(
      (member) => parseSignature(member.signature).name !== member.name,
    );

    expect(mismatched.map((member) => member.signature)).toEqual([]);
  });

  it("documents each member once", () => {
    const keys = members.map((member) => `${member.owner}.${member.name}`);

    expect(keys.filter((key, i) => keys.indexOf(key) !== i)).toEqual([]);
  });

  it("gives every section a distinct id", () => {
    const ids = docs.sections.map((section) => section.id);

    expect(new Set(ids).size).toEqual(ids.length);
  });

  const text = renderLlmsTxt(docs);

  it("renders every member", () => {
    const missing = members
      .map((member) => {
        const parsed = parseSignature(member.signature);
        const path = pathOf(member.owner)!;
        return parsed.kind === "property"
          ? `| \`${path}.${member.name}\` |`
          : `\`${path}.${callForm(member.signature)}\``;
      })
      .filter((needle) => !text.includes(needle));

    expect(missing).toEqual([]);
  });

  it("renders every example script", () => {
    const missing = docs.exampleScripts.filter(
      (example) => !text.includes(example.source.trimEnd()),
    );

    expect(missing.map((example) => example.id)).toEqual([]);
  });

  it("states the API version under the title", () => {
    expect(text).toContain(
      `# ${docs.title}\n\nAPI version ${SCRIPT_API_VERSION}.`,
    );
  });

  it("numbers the agent notes and worked examples after the sections", () => {
    expect(text).toContain("## 9. Notes for AI agents");
    expect(text).toContain("## 10. Worked examples");
  });

  it("gives every numbered section a number of its own", () => {
    const numbers = docs.sections.flatMap((section) =>
      section.number ? [section.number] : [],
    );

    expect(new Set(numbers).size).toEqual(numbers.length);
  });
});

describe("candidates", () => {
  it("keeps the edits candidate out of the official docs", () => {
    expect(renderLlmsTxt(scriptingDocs)).not.toContain("set(changes: {");
    expect(renderLlmsTxt(editsCandidateDocs)).toContain("set(changes: {");
  });
});
