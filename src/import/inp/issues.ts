export type ParserIssues = {
  unsupportedSections?: Set<string>;
  extendedPeriodSimulation?: boolean;
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

  addEPS() {
    this.issues.extendedPeriodSimulation = true;
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

  buildResult(): ParserIssues | null {
    if (Object.keys(this.issues).length === 0) return null;

    return this.issues;
  }
}
