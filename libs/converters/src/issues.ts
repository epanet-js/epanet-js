export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "modelFileMissing"
  | "modelFileAmbiguous"
  | "modelFileUnreadable"
  | "tableMissing"
  | "nodeIdentifierMissing"
  | "nodeCoordinatesMissing"
  | "nodeHydraulicsMissing"
  | "nodePressureStatusUnknown"
  | "nodeFixedHeadUnsupported"
  | "tankHydraulicsMissing"
  | "tankVolumeCurveUnsupported"
  | "linkIdentifierMissing"
  | "linkEndpointMissing"
  | "linkHydraulicsMissing"
  | "pipeHeadlossFormulaUnsupported"
  | "valveKindUnknown"
  | "pumpDefinitionUnsupported"
  | "unitSystemMissing"
  | "unitSystemUnsupported"
  | "coordinateSystemMissing";

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
