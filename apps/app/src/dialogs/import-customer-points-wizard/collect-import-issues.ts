import type { Feature } from "geojson";
import type { Issue } from "@epanet-js/converters";
import { CustomerPointsIssuesAccumulator } from "@epanet-js/gis-importers";

const placeholder = {
  type: "Feature",
  geometry: null,
  properties: null,
} as unknown as Feature;

export const collectImportIssues = (
  issues: Issue[],
  into: CustomerPointsIssuesAccumulator,
): void => {
  for (const issue of issues) {
    const feature = (issue.raw as Feature | undefined) ?? placeholder;

    switch (issue.code) {
      case "featureGeometryUnsupported":
        into.addSkippedNonPoint(feature);
        break;
      case "featureGeometryMissing":
        into.addSkippedMissingCoordinates(feature);
        break;
      case "featureCoordinatesInvalid":
        into.addSkippedInvalidProjection(feature);
        break;
      case "attributeValueUnreadable":
        into.addSkippedInvalidDemand(feature);
        break;
      case "coordinateSystemUnsupported":
        into.addSkippedUnsupportedCrs(feature);
        break;
      case "coordinateSystemMismatch":
        into.addSkippedProjectionConversionFailure(feature);
        break;
      default:
        // Everything else is either file-level and already surfaced by the
        // step that scanned, or belongs to a converter rather than an import.
        break;
    }
  }
};
