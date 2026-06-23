import { Severity, ValidationGroup, ValidationIssue } from "./types";

const severityRank: Record<Severity, number> = { error: 0, warning: 1 };

export const groupIssues = (issues: ValidationIssue[]): ValidationGroup[] => {
  const groups = new Map<string, ValidationGroup>();

  for (const issue of issues) {
    const existing = groups.get(issue.ruleId);
    if (existing) {
      existing.issues.push(issue);
      continue;
    }
    groups.set(issue.ruleId, {
      ruleId: issue.ruleId,
      entityType: issue.entityType,
      field: issue.field,
      severity: issue.severity,
      message: issue.message,
      issues: [issue],
    });
  }

  return [...groups.values()].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity],
  );
};
