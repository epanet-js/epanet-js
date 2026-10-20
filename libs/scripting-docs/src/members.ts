import type { Markdown, Member } from "./types";

export const memberOf =
  (owner: string) =>
  (member: Omit<Member, "owner">): Member => ({ owner, ...member });

export const propertyOf =
  (owner: string) =>
  (
    name: string,
    type: string,
    summary: Markdown,
    description?: Markdown,
  ): Member => ({
    owner,
    name,
    signature: `readonly ${name}: ${type}`,
    summary,
    ...(description ? { description } : {}),
  });
