export type IssueSeverity = "error" | "warning";

export const issueCodes = [
  "modelFileMissing",
  "modelFileAmbiguous",
  "modelFileUnreadable",
  "tableMissing",
  "nodeIdentifierMissing",
  "nodeCoordinatesMissing",
  "nodeHydraulicsMissing",
  "nodePressureStatusUnknown",
  "nodeFixedHeadUnsupported",
  "junctionDemandPatternUnreadable",
  "tankHydraulicsMissing",
  "tankVolumeCurveUnsupported",
  "linkIdentifierMissing",
  "linkEndpointMissing",
  "linkHydraulicsMissing",
  "pipeHeadlossFormulaUnsupported",
  "pipeParallelCountUnsupported",
  "valveKindUnknown",
  "valveScheduleUnreadable",
  "valveOperatingRuleUnsupported",
  "pumpDefinitionUnsupported",
  "pumpControlUnsupported",
  "remotePressureControlUnsupported",
  "flowModulatedSetpointUnsupported",
  "tankFloatControlUnsupported",
  "customAttributeValueUnreadable",
  "zoneGeometryUnreadable",
  "unitSystemMissing",
  "unitSystemUnsupported",
  "coordinateSystemMissing",
  "sourceUnreadable",
  "sourceEmpty",
  "sourceFilesIncomplete",
  "featureGeometryMissing",
  "featureGeometryUnsupported",
  "featureCoordinatesInvalid",
  "attributeMissing",
  "attributeValueUnreadable",
] as const;

export type IssueCode = (typeof issueCodes)[number];

export type ParserIssue = {
  code: IssueCode;
  severity: IssueSeverity;
  ref?: string;
  context?: Record<string, string | number>;
};

export class IssueCollector {
  private issues: ParserIssue[] = [];
  private seen = new Set<string>();

  add(issue: ParserIssue): void {
    const key = `${issue.code}|${issue.ref ?? ""}`;
    if (this.seen.has(key)) return;

    this.seen.add(key);
    this.issues.push(issue);
  }

  build(): ParserIssue[] {
    return this.issues;
  }
}

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

export const distinctIssueCodes = (issues: ParserIssue[]): IssueCode[] => [
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
