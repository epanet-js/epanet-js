import { parseSignature } from "./signature";
import type {
  Chapter,
  InterfaceDef,
  Member,
  ScriptingDocs,
  Section,
  SectionDef,
} from "./types";

export type Appendix = { id: string; number: string; title: string };

export const numberSections = ({
  preface,
  chapters,
}: {
  preface: SectionDef[];
  chapters: Chapter[];
}): Section[] => [
  ...preface,
  ...chapters.flatMap(({ subsections = [], ...chapter }, index) => {
    const number = String(index + 1);
    return [
      { ...chapter, number },
      ...subsections.map((section, subIndex) => ({
        ...section,
        number: `${number}.${subIndex + 1}`,
      })),
    ];
  }),
];

export const sectionTitle = (section: {
  number?: string;
  title: string;
}): string => {
  if (!section.number) return section.title;
  return section.number.includes(".")
    ? `${section.number} ${section.title}`
    : `${section.number}. ${section.title}`;
};

export const sectionLevel = (section: { number?: string }): number =>
  section.number ? section.number.split(".").length : 1;

export const appendixOf = (
  docs: ScriptingDocs,
): { agentNotes: Appendix; workedExamples: Appendix; apiIndex: Appendix } => {
  const next =
    Math.max(
      0,
      ...docs.sections
        .filter((section) => section.number && !section.number.includes("."))
        .map((section) => Number(section.number)),
    ) + 1;
  return {
    agentNotes: {
      id: "agent-notes",
      number: String(next),
      title: "Notes for AI agents",
    },
    workedExamples: {
      id: "worked-examples",
      number: String(next + 1),
      title: "Worked examples",
    },
    apiIndex: {
      id: "api-index",
      number: String(next + 2),
      title: "API index",
    },
  };
};

export type ObjectIndexGroup = {
  from: InterfaceDef;
  section: Section | null;
  members: Member[];
};

export type ObjectIndex = { iface: InterfaceDef; groups: ObjectIndexGroup[] };

const ownMembersBySection = (
  docs: ScriptingDocs,
  iface: InterfaceDef,
): { section: Section; members: Member[] }[] =>
  docs.sections.flatMap((section) => {
    const members = (section.members ?? []).filter(
      (member) => member.owner === iface.name,
    );
    return members.length > 0 ? [{ section, members }] : [];
  });

const ancestorsOf = (
  docs: ScriptingDocs,
  iface: InterfaceDef,
): InterfaceDef[] => {
  const parent = docs.interfaces.find(
    (candidate) => candidate.name === iface.extends,
  );
  return parent ? [parent, ...ancestorsOf(docs, parent)] : [];
};

export const objectIndexOf = (docs: ScriptingDocs): ObjectIndex[] =>
  [...docs.interfaces]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((iface) => {
      const own = ownMembersBySection(docs, iface);
      const groups: ObjectIndexGroup[] = own.map(({ section, members }) => ({
        from: iface,
        section: own.length > 1 ? section : null,
        members,
      }));
      const seen = new Set(
        own.flatMap(({ members }) => members.map((member) => member.name)),
      );
      for (const ancestor of ancestorsOf(docs, iface)) {
        const members = ownMembersBySection(docs, ancestor)
          .flatMap((group) => group.members)
          .filter((member) => !seen.has(member.name));
        members.forEach((member) => seen.add(member.name));
        if (members.length > 0) {
          groups.push({ from: ancestor, section: null, members });
        }
      }
      return { iface, groups };
    });

export const ownersOf = (
  docs: ScriptingDocs,
  section: Section,
): { iface: InterfaceDef; members: Member[] }[] => {
  const members = section.members ?? [];
  return [...new Set(members.map((member) => member.owner))].map((owner) => {
    const iface = docs.interfaces.find((candidate) => candidate.name === owner);
    if (!iface) throw new Error(`No interface named ${owner}`);
    return {
      iface,
      members: members.filter((member) => member.owner === owner),
    };
  });
};

export const splitMembers = (
  members: Member[],
): { properties: Member[]; methods: Member[] } => ({
  properties: members.filter(
    (member) => parseSignature(member.signature).kind === "property",
  ),
  methods: members.filter(
    (member) => parseSignature(member.signature).kind === "method",
  ),
});
