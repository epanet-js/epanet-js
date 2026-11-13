import type { IssueCode, Issue } from "@epanet-js/converters";

export type IssueRef = {
  ref: string;
  label?: string;
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
        refs: refsOf(issue, context),
      });
      continue;
    }

    group.count += 1;
    group.refs.push(...refsOf(issue, context));
  }

  return [...groups.values()];
};

const refsOf = ({ ref, label }: Issue, context: string[]): IssueRef[] => {
  if (ref === undefined) return [];
  return [label === undefined ? { ref, context } : { ref, label, context }];
};

const contextValues = (issue: Issue): string[] =>
  Object.values(issue.context ?? {}).map(String);
