import { SCRIPT_API_VERSION } from "./api-version";
import { editsCandidateDocs, scriptingDocs } from "./definition";
import { objectIndexOf } from "./outline";
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

  describe("object index", () => {
    const index = objectIndexOf(docs);
    const entryOf = (name: string) =>
      index.find(({ iface }) => iface.name === name)!;
    const namesIn = (name: string) =>
      entryOf(name).groups.flatMap((group) =>
        group.members.map((member) => member.name),
      );

    it("lists every interface", () => {
      expect(index.map(({ iface }) => iface.name).sort()).toEqual(
        docs.interfaces.map((iface) => iface.name).sort(),
      );
    });

    it("lists every member under its owner", () => {
      const missing = members.filter(
        (member) => !namesIn(member.owner).includes(member.name),
      );

      expect(missing.map((member) => member.name)).toEqual([]);
    });

    it("adds the members an object inherits", () => {
      const inheritedFrom = entryOf("Pipe")
        .groups.map((group) => group.from.name)
        .filter((name) => name !== "Pipe");

      expect(inheritedFrom).toEqual(["LinkAsset", "Asset"]);
      expect(namesIn("Pipe")).toEqual(
        expect.arrayContaining(["diameter", "startNode", "label"]),
      );
    });

    it("shows a member an object redefines once, as its own", () => {
      const duplicated = index.flatMap(({ iface }) => {
        const names = namesIn(iface.name);
        return names.filter((name, i) => names.indexOf(name) !== i);
      });

      expect(duplicated).toEqual([]);
      const results = entryOf("Pipe").groups.find((group) =>
        group.members.some((member) => member.name === "results"),
      );
      expect(results?.from.name).toEqual("Pipe");
    });

    it("groups an object by section only when it spans several", () => {
      expect(
        entryOf("Network").groups.every((group) => group.section !== null),
      ).toBe(true);
      expect(entryOf("Pipe").groups.map((group) => group.section)).toEqual([
        null,
        null,
        null,
      ]);
    });
  });
});

describe("candidates", () => {
  it("keeps the edits candidate out of the official docs", () => {
    expect(renderLlmsTxt(scriptingDocs)).not.toContain("set(changes: {");
    expect(renderLlmsTxt(editsCandidateDocs)).toContain("set(changes: {");
  });
});
