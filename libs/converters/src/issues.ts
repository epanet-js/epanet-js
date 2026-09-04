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
  "coordinateSystemUnknown",
  "coordinateSystemUnsupported",
  "coordinateSystemMismatch",
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

export type Issue = {
  code: IssueCode;
  severity: IssueSeverity;
  ref?: string;
  context?: Record<string, string | number>;
  /** The source record this is about, verbatim and opaque. */
  raw?: unknown;
};

export class IssueCollector {
  private issues: Issue[] = [];
  private seen = new Set<string>();

  add(issue: Issue): void {
    const key = `${issue.code}|${issue.ref ?? ""}`;
    if (this.seen.has(key)) return;

    this.seen.add(key);
    this.issues.push(issue);
  }

  build(): Issue[] {
    return this.issues;
  }
}
