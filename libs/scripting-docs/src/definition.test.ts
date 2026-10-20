import { scriptingDocs } from "./definition";
import { renderLlmsTxt } from "./render/markdown";
import { callForm, parseSignature } from "./signature";

const members = scriptingDocs.sections.flatMap(
  (section) => section.members ?? [],
);
const pathOf = (owner: string) =>
  scriptingDocs.interfaces.find((iface) => iface.name === owner)?.path;

describe("scriptingDocs", () => {
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
    const ids = scriptingDocs.sections.map((section) => section.id);

    expect(new Set(ids).size).toEqual(ids.length);
  });
});

describe("renderLlmsTxt", () => {
  const text = renderLlmsTxt(scriptingDocs);

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
    const missing = scriptingDocs.exampleScripts.filter(
      (example) => !text.includes(example.source.trimEnd()),
    );

    expect(missing.map((example) => example.id)).toEqual([]);
  });

  it("numbers the agent notes and worked examples after the sections", () => {
    expect(text).toContain("## 8. Notes for AI agents");
    expect(text).toContain("## 9. Worked examples");
  });
});
