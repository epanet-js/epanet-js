import type { IssueCode, ParserIssue } from "@epanet-js/converters";

export type IssueRef = {
  ref: string;
  context: string[];
};

export type IssueGroup = {
  code: IssueCode;
  count: number;
  context: string[];
  refs: IssueRef[];
};

export const blockingIssues = (issues: ParserIssue[]): ParserIssue[] =>
  issues.filter((issue) => issue.severity === "error");

export const issueCodes = (issues: ParserIssue[]): IssueCode[] => [
  ...new Set(issues.map((issue) => issue.code)),
];

export const groupIssues = (issues: ParserIssue[]): IssueGroup[] => {
  const groups = new Map<IssueCode, IssueGroup>();

  for (const issue of issues) {
    const context = contextValues(issue);
    const group = groups.get(issue.code);

    if (!group) {
      groups.set(issue.code, {
        code: issue.code,
        count: 1,
        context,
        refs: issue.ref === undefined ? [] : [{ ref: issue.ref, context }],
      });
      continue;
    }

    group.count += 1;
    if (issue.ref !== undefined) group.refs.push({ ref: issue.ref, context });
  }

  return [...groups.values()];
};

const contextValues = (issue: ParserIssue): string[] =>
  Object.values(issue.context ?? {}).map(String);
