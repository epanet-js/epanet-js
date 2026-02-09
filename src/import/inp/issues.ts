export type WaterQualityType = "AGE" | "CHEMICAL" | "TRACE";

export type ParserIssues = {
  unsupportedSections?: Set<string>;
  nodesMissingCoordinates?: Set<string>;
  invalidCoordinates?: Set<string>;
  invalidVertices?: Set<string>;
  nonDefaultOptions?: Map<string, string | number>;
  nonDefaultTimes?: Map<string, string | number>;
  unbalancedDiff?: {
    defaultSetting: string;
    customSetting: string;
  };
  gpvValves?: boolean;
  hasReservoirPatterns?: number;
  hasTankCurves?: number;
  hasPumpPatterns?: number;
  hasPumpCurves?: number;
  hasPCVCurves?: number;
  hasUnusedCurves?: number;
  waterQualityType?: WaterQualityType;
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

  addGPVUsed() {
    this.issues.gpvValves = true;
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

  hasUnbalancedDiff(customSetting: string, defaultSetting: string) {
    this.issues.unbalancedDiff = { customSetting, defaultSetting };
  }

  addReservoirPattern() {
    this.issues.hasReservoirPatterns =
      (this.issues.hasReservoirPatterns || 0) + 1;
  }

  addTankCurve() {
    this.issues.hasTankCurves = (this.issues.hasTankCurves || 0) + 1;
  }

  addPumpPattern() {
    this.issues.hasPumpPatterns = (this.issues.hasPumpPatterns || 0) + 1;
  }

  addPumpCurve() {
    this.issues.hasPumpCurves = (this.issues.hasPumpCurves || 0) + 1;
  }

  addPCVCurve() {
    this.issues.hasPCVCurves = (this.issues.hasPCVCurves || 0) + 1;
  }

  addUnusedCurve() {
    this.issues.hasUnusedCurves = (this.issues.hasUnusedCurves || 0) + 1;
  }

  addWaterQualityType(type: WaterQualityType) {
    this.issues.waterQualityType = type;
  }

  buildResult(): ParserIssues | null {
    if (Object.keys(this.issues).length === 0) return null;

    return this.issues;
  }
}
