import {
  appendixOf,
  ownersOf,
  sectionLevel,
  sectionTitle,
  splitMembers,
} from "../outline";
import { callForm, parseSignature } from "../signature";
import type {
  InterfaceDef,
  Member,
  ScriptingDocs,
  Section,
  TypeDef,
} from "../types";

const heading = (level: number, text: string): string =>
  `${"#".repeat(Math.min(6, level))} ${text}`;

const cell = (text: string): string =>
  text.replace(/\|/g, "\\|").replace(/\n+/g, " ");

const blocks = (...parts: (string | null | undefined | false)[]): string =>
  parts.filter((part): part is string => !!part).join("\n\n");

const renderType = (type: TypeDef): string =>
  blocks(
    `**\`${type.name}\`** — ${type.summary}`,
    `\`\`\`ts\n${type.definition}\n\`\`\``,
    type.description,
  );

const renderPropertyTable = (path: string, members: Member[]): string =>
  [
    "| Property | Type | Description |",
    "| --- | --- | --- |",
    ...members.map((member) => {
      const parsed = parseSignature(member.signature);
      const type = parsed.kind === "property" ? parsed.type : "";
      const text = blocks(member.summary, member.description);
      return `| \`${path}.${member.name}\` | \`${cell(type)}\` | ${cell(text)} |`;
    }),
  ].join("\n");

const renderMethod = (path: string, member: Member, level: number): string =>
  blocks(
    heading(level, `\`${path}.${callForm(member.signature)}\``),
    member.summary,
    `\`\`\`ts\n${member.signature}\n\`\`\``,
    member.description,
    !!member.params?.length &&
      [
        "**Parameters**",
        ...member.params.map(
          (param) => `- \`${param.name}\` — ${param.description}`,
        ),
      ].join("\n"),
    member.returns && `**Returns** ${member.returns}`,
    !!member.throws?.length &&
      ["**Throws**", ...member.throws.map((text) => `- ${text}`)].join("\n"),
    ...(member.examples ?? []).map((example) =>
      blocks(
        example.title && `*${example.title}*`,
        `\`\`\`js\n${example.code}\n\`\`\``,
      ),
    ),
  );

const renderOwner = (
  iface: InterfaceDef,
  members: Member[],
  level: number,
): string => {
  const { properties, methods } = splitMembers(members);
  return blocks(
    properties.length > 0 && renderPropertyTable(iface.path, properties),
    ...methods.map((member) => renderMethod(iface.path, member, level)),
  );
};

const renderSection = (docs: ScriptingDocs, section: Section): string => {
  const level = sectionLevel(section) + 1;
  const owners = ownersOf(docs, section);
  const grouped = owners.length > 1;
  return blocks(
    heading(level, sectionTitle(section)),
    section.intro,
    ...owners.map(({ iface, members: ownMembers }) => {
      if (!grouped) return renderOwner(iface, ownMembers, level + 1);
      return blocks(
        heading(level + 1, `\`${iface.name}\` (\`${iface.path}\`)`),
        [
          iface.summary,
          iface.extends && `Has every \`${iface.extends}\` member.`,
        ]
          .filter(Boolean)
          .join(" "),
        renderOwner(iface, ownMembers, level + 2),
      );
    }),
    ...(section.types ?? []).map(renderType),
    section.notes,
  );
};

export const renderLlmsTxt = (docs: ScriptingDocs): string => {
  const { agentNotes, workedExamples } = appendixOf(docs);
  return `${blocks(
    heading(1, docs.title),
    `> ${docs.summary}`,
    docs.intro,
    ...docs.sections.map((section) => renderSection(docs, section)),
    heading(2, sectionTitle(agentNotes)),
    docs.agentRules.map((rule) => `- ${rule}`).join("\n"),
    heading(2, sectionTitle(workedExamples)),
    "The built-in examples from the Scripts panel.",
    ...docs.exampleScripts.map((example) =>
      blocks(
        heading(3, example.name),
        `\`\`\`js\n${example.source.trimEnd()}\n\`\`\``,
      ),
    ),
  )}\n`;
};
