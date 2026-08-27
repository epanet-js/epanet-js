import { Feature } from "geojson";

export type CustomerPointsParserIssues = {
  skippedNonPointFeatures?: Feature[];
  skippedInvalidCoordinates?: Feature[];
  skippedMissingCoordinates?: Feature[];
  skippedInvalidProjection?: Feature[];
  skippedInvalidDemands?: Feature[];
  skippedCreationFailures?: Feature[];
  skippedUnsupportedCrs?: Feature[];
  skippedProjectionConversionFailures?: Feature[];
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

  addSkippedMissingCoordinates(feature: Feature) {
    if (!this.issues.skippedMissingCoordinates) {
      this.issues.skippedMissingCoordinates = [];
    }
    this.issues.skippedMissingCoordinates.push(feature);
  }

  addSkippedInvalidProjection(feature: Feature) {
    if (!this.issues.skippedInvalidProjection) {
      this.issues.skippedInvalidProjection = [];
    }
    this.issues.skippedInvalidProjection.push(feature);
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

  addSkippedUnsupportedCrs(feature: Feature) {
    if (!this.issues.skippedUnsupportedCrs) {
      this.issues.skippedUnsupportedCrs = [];
    }
    this.issues.skippedUnsupportedCrs.push(feature);
  }

  addSkippedProjectionConversionFailure(feature: Feature) {
    if (!this.issues.skippedProjectionConversionFailures) {
      this.issues.skippedProjectionConversionFailures = [];
    }
    this.issues.skippedProjectionConversionFailures.push(feature);
  }

  count(): number {
    let totalIssues = 0;

    if (this.issues.skippedNonPointFeatures) {
      totalIssues += this.issues.skippedNonPointFeatures.length;
    }
    if (this.issues.skippedInvalidCoordinates) {
      totalIssues += this.issues.skippedInvalidCoordinates.length;
    }
    if (this.issues.skippedMissingCoordinates) {
      totalIssues += this.issues.skippedMissingCoordinates.length;
    }
    if (this.issues.skippedInvalidProjection) {
      totalIssues += this.issues.skippedInvalidProjection.length;
    }
    if (this.issues.skippedInvalidDemands) {
      totalIssues += this.issues.skippedInvalidDemands.length;
    }
    if (this.issues.skippedCreationFailures) {
      totalIssues += this.issues.skippedCreationFailures.length;
    }
    if (this.issues.skippedUnsupportedCrs) {
      totalIssues += this.issues.skippedUnsupportedCrs.length;
    }
    if (this.issues.skippedProjectionConversionFailures) {
      totalIssues += this.issues.skippedProjectionConversionFailures.length;
    }

    return totalIssues;
  }

  buildResult(): CustomerPointsParserIssues | null {
    if (Object.keys(this.issues).length === 0) return null;

    return this.issues;
  }
}
