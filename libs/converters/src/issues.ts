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
  "zoneGeometryUnreadable",
  "unitSystemMissing",
  "unitSystemUnsupported",
  "coordinateSystemMissing",
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
