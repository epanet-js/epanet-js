import type { IssueCode, Issue } from "@epanet-js/converters";

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

export const blockingIssues = (issues: Issue[]): Issue[] =>
  issues.filter((issue) => issue.severity === "error");

export const issueCodes = (issues: Issue[]): IssueCode[] => [
  ...new Set(issues.map((issue) => issue.code)),
];

export const groupIssues = (issues: Issue[]): IssueGroup[] => {
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

const contextValues = (issue: Issue): string[] =>
  Object.values(issue.context ?? {}).map(String);
