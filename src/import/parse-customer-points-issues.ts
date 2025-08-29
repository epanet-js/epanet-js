import { Feature } from "geojson";

export type CustomerPointsParserIssues = {
  skippedNonPointFeatures?: Feature[];
  skippedInvalidCoordinates?: Feature[];
  skippedInvalidDemands?: Feature[];
  skippedCreationFailures?: Feature[];
};

export class CustomerPointsIssuesAccumulator {
  private issues: CustomerPointsParserIssues;

  constructor() {
    this.issues = {};
  }

  addSkippedNonPoint(feature: Feature) {
    if (!this.issues.skippedNonPointFeatures) {
      this.issues.skippedNonPointFeatures = [];
    }
    this.issues.skippedNonPointFeatures.push(feature);
  }

  addSkippedInvalidCoordinates(feature: Feature) {
    if (!this.issues.skippedInvalidCoordinates) {
      this.issues.skippedInvalidCoordinates = [];
    }
    this.issues.skippedInvalidCoordinates.push(feature);
  }

  addSkippedInvalidDemand(feature: Feature) {
    if (!this.issues.skippedInvalidDemands) {
      this.issues.skippedInvalidDemands = [];
    }
    this.issues.skippedInvalidDemands.push(feature);
  }

  addSkippedCreationFailure(feature: Feature) {
    if (!this.issues.skippedCreationFailures) {
      this.issues.skippedCreationFailures = [];
    }
    this.issues.skippedCreationFailures.push(feature);
  }

  buildResult(): CustomerPointsParserIssues | null {
    if (Object.keys(this.issues).length === 0) return null;

    return this.issues;
  }
}
