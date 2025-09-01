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

  count(): number {
    let totalIssues = 0;

    if (this.issues.skippedNonPointFeatures) {
      totalIssues += this.issues.skippedNonPointFeatures.length;
    }
    if (this.issues.skippedInvalidCoordinates) {
      totalIssues += this.issues.skippedInvalidCoordinates.length;
    }
    if (this.issues.skippedInvalidDemands) {
      totalIssues += this.issues.skippedInvalidDemands.length;
    }
    if (this.issues.skippedCreationFailures) {
      totalIssues += this.issues.skippedCreationFailures.length;
    }

    return totalIssues;
  }

  buildResult(): CustomerPointsParserIssues | null {
    if (Object.keys(this.issues).length === 0) return null;

    return this.issues;
  }
}
