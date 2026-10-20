import { parseSignature } from "./signature";
import type { InterfaceDef, Member, ScriptingDocs, Section } from "./types";

export type Appendix = { id: string; number: string; title: string };

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
): { agentNotes: Appendix; workedExamples: Appendix } => {
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
  };
};

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
