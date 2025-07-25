export type CustomerPointsParserIssues = {
  skippedNonPointFeatures?: number;
  skippedInvalidCoordinates?: number;
  skippedInvalidLines?: number;
  skippedCreationFailures?: number;
  skippedNoValidJunction?: number;
  connectionFailures?: number;
};

export class CustomerPointsIssuesAccumulator {
  private issues: CustomerPointsParserIssues;

  constructor() {
    this.issues = {};
  }

  addSkippedNonPoint() {
    this.issues.skippedNonPointFeatures =
      (this.issues.skippedNonPointFeatures || 0) + 1;
  }

  addSkippedInvalidCoordinates() {
    this.issues.skippedInvalidCoordinates =
      (this.issues.skippedInvalidCoordinates || 0) + 1;
  }

  addSkippedInvalidLine(_rawData?: any) {
    this.issues.skippedInvalidLines =
      (this.issues.skippedInvalidLines || 0) + 1;
  }

  addSkippedCreationFailure() {
    this.issues.skippedCreationFailures =
      (this.issues.skippedCreationFailures || 0) + 1;
  }

  addSkippedNoValidJunction() {
    this.issues.skippedNoValidJunction =
      (this.issues.skippedNoValidJunction || 0) + 1;
  }

  addConnectionFailure() {
    this.issues.connectionFailures = (this.issues.connectionFailures || 0) + 1;
  }

  buildResult(): CustomerPointsParserIssues | null {
    if (Object.keys(this.issues).length === 0) return null;

    return this.issues;
  }
}
