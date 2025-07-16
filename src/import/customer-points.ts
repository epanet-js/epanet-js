import { FeatureCollection } from "geojson";
import {
  createCustomerPoint,
  CustomerPoint,
} from "src/hydraulic-model/customer-points";
import {
  CustomerPointsParserIssues,
  CustomerPointsIssuesAccumulator,
} from "./customer-points-issues";
import {
  connectCustomerPointToPipe,
  SpatialIndexData,
} from "src/hydraulic-model/model-operations/connect-customer-points";

export type CustomerPointsStreamingParseResult = {
  customerPoints: Map<string, CustomerPoint>;
  issues: CustomerPointsParserIssues | null;
};

export const parseCustomerPointsStreamingFromFile = (
  fileContent: string,
  spatialIndexData: SpatialIndexData,
  startingId: number = 1,
): CustomerPointsStreamingParseResult => {
  const trimmedContent = fileContent.trim();

  if (trimmedContent.startsWith("{")) {
    try {
      const geoJson = JSON.parse(fileContent);
      if (geoJson.type === "FeatureCollection") {
        return parseGeoJSONStreamingToCustomerPoints(
          geoJson,
          spatialIndexData,
          startingId,
        );
      }
    } catch (error) {}
  }

  return parseGeoJSONLStreamingToCustomerPoints(
    fileContent,
    spatialIndexData,
    startingId,
  );
};

const parseGeoJSONStreamingToCustomerPoints = (
  geoJson: FeatureCollection,
  spatialIndexData: SpatialIndexData,
  startingId: number = 1,
): CustomerPointsStreamingParseResult => {
  if (!geoJson || geoJson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: must be a FeatureCollection");
  }

  const customerPoints = new Map<string, CustomerPoint>();
  const issues = new CustomerPointsIssuesAccumulator();
  let currentId = startingId;

  for (const feature of geoJson.features || []) {
    if (feature.geometry?.type !== "Point") {
      issues.addSkippedNonPoint();
      continue;
    }

    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      issues.addSkippedInvalidCoordinates();
      continue;
    }

    try {
      const customerPoint = createCustomerPoint(
        [coordinates[0], coordinates[1]],
        feature.properties || {},
        currentId.toString(),
      );

      const connection = connectCustomerPointToPipe(
        customerPoint,
        spatialIndexData,
      );
      customerPoint.connection = connection || undefined;

      customerPoints.set(customerPoint.id, customerPoint);
      currentId++;
    } catch (error) {
      issues.addSkippedCreationFailure();
    }
  }

  return {
    customerPoints,
    issues: issues.buildResult(),
  };
};

const parseGeoJSONLStreamingToCustomerPoints = (
  geoJsonLText: string,
  spatialIndexData: SpatialIndexData,
  startingId: number = 1,
): CustomerPointsStreamingParseResult => {
  const lines = geoJsonLText.split("\n").filter((line) => line.trim());
  const customerPoints = new Map<string, CustomerPoint>();
  const issues = new CustomerPointsIssuesAccumulator();
  let currentId = startingId;

  for (const line of lines) {
    try {
      const json = JSON.parse(line);

      if (json.type === "metadata") {
        continue;
      }

      if (json.type === "Feature") {
        if (json.geometry?.type !== "Point") {
          issues.addSkippedNonPoint();
          continue;
        }

        const coordinates = json.geometry.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          issues.addSkippedInvalidCoordinates();
          continue;
        }

        try {
          const customerPoint = createCustomerPoint(
            [coordinates[0], coordinates[1]],
            json.properties || {},
            currentId.toString(),
          );

          const connection = connectCustomerPointToPipe(
            customerPoint,
            spatialIndexData,
          );
          customerPoint.connection = connection || undefined;

          customerPoints.set(customerPoint.id, customerPoint);
          currentId++;
        } catch (error) {
          issues.addSkippedCreationFailure();
        }
      }
    } catch (error) {
      issues.addSkippedInvalidLine();
    }
  }

  return {
    customerPoints,
    issues: issues.buildResult(),
  };
};
