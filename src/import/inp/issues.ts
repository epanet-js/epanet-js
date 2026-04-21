export type WaterQualityType = "age" | "chemical" | "trace";

export type ParserIssues = {
  unsupportedSections?: Set<string>;
  nodesMissingCoordinates?: Set<string>;
  invalidCoordinates?: Set<string>;
  invalidVertices?: Set<string>;
  nonDefaultOptions?: Map<string, string | number>;
  nonDefaultTimes?: Map<string, string | number>;
  hasInvalidPumpCurves?: number;
  hasUndefinedPumpCurve?: number;
};

export class IssuesAccumulator {
  private issues: ParserIssues;

  constructor() {
    this.issues = {};
  }

  addUsedSection(sectionName: string) {
    if (!this.issues.unsupportedSections)
      this.issues.unsupportedSections = new Set<string>();

    this.issues.unsupportedSections.add(sectionName);
  }

  addUsedOption(optionName: string, defaultValue: number | string) {
    if (!this.issues.nonDefaultOptions)
      this.issues.nonDefaultOptions = new Map<string, string | number>();

    this.issues.nonDefaultOptions.set(optionName, defaultValue);
  }

  addUsedTimeSetting(optionName: string, defaultValue: number | string) {
    if (!this.issues.nonDefaultTimes)
      this.issues.nonDefaultTimes = new Map<string, string | number>();

    this.issues.nonDefaultTimes.set(optionName, defaultValue);
  }

  addMissingCoordinates(nodeId: string) {
    if (!this.issues.nodesMissingCoordinates)
      this.issues.nodesMissingCoordinates = new Set<string>();

    this.issues.nodesMissingCoordinates.add(nodeId);
  }

  addInvalidCoordinates(nodeId: string) {
    if (!this.issues.invalidCoordinates)
      this.issues.invalidCoordinates = new Set<string>();

    this.issues.invalidCoordinates.add(nodeId);
  }

  addInvalidVertices(linkId: string) {
    if (!this.issues.invalidVertices)
      this.issues.invalidVertices = new Set<string>();

    this.issues.invalidVertices.add(linkId);
  }

  addInvalidPumpCurve() {
    this.issues.hasInvalidPumpCurves =
      (this.issues.hasInvalidPumpCurves || 0) + 1;
  }

  addUndefinedPumpCurve() {
    this.issues.hasUndefinedPumpCurve =
      (this.issues.hasUndefinedPumpCurve || 0) + 1;
  }

  buildResult(): ParserIssues | null {
    if (Object.keys(this.issues).length === 0) return null;

    return this.issues;
  }
}
