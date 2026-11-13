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
  "nodeElevationUnresolved",
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
  "valveParallelRegulatorUnsupported",
  "pumpDefinitionUnsupported",
  "pumpControlUnsupported",
  "pumpSpeedControlUnsupported",
  "remotePressureControlUnsupported",
  "flowModulatedSetpointUnsupported",
  "tankFloatControlUnsupported",
  "customAttributeValueUnreadable",
  "zoneGeometryUnreadable",
  "selectionSetMembersUnreadable",
  "selectionSetGroupUnreadable",
  "unitSystemMissing",
  "unitSystemUnsupported",
  "coordinateSystemMissing",
  "coordinateSystemUnknown",
  "coordinateSystemUnsupported",
  "coordinateSystemMismatch",
  "coordinateAttributesUnknown",
  "coordinateAttributesMissing",
  "sourceUnreadable",
  "sourceHeaderMissing",
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
  label?: string;
  context?: Record<string, string | number>;
  /** The source record this is about, verbatim and opaque. */
  raw?: unknown;
};

export class IssueCollector {
  private issues: Issue[] = [];
  private seen = new Set<string>();

  add({ label, ...issue }: Issue): void {
    const key = `${issue.code}|${issue.ref ?? ""}`;
    if (this.seen.has(key)) return;

    this.seen.add(key);
    this.issues.push(label === undefined ? issue : { ...issue, label });
  }

  build(): Issue[] {
    return this.issues;
  }
}
