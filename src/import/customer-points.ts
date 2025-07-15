import { FeatureCollection } from "geojson";
import {
  createCustomerPoint,
  CustomerPoint,
} from "src/hydraulic-model/customer-points";
import {
  CustomerPointsParserIssues,
  CustomerPointsIssuesAccumulator,
} from "./customer-points-issues";

export type CustomerPointsParseResult = {
  customerPoints: CustomerPoint[];
  issues: CustomerPointsParserIssues | null;
};

export const parseGeoJSONToCustomerPoints = (
  geoJson: FeatureCollection,
  startingId: number = 1,
): CustomerPointsParseResult => {
  if (!geoJson || geoJson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: must be a FeatureCollection");
  }

  const customerPoints: CustomerPoint[] = [];
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
      customerPoints.push(customerPoint);
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

export const parseGeoJSONLToCustomerPoints = (
  geoJsonLText: string,
  startingId: number = 1,
): CustomerPointsParseResult => {
  const lines = geoJsonLText.split("\n").filter((line) => line.trim());
  const customerPoints: CustomerPoint[] = [];
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
          customerPoints.push(customerPoint);
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

export const parseCustomerPointsFromFile = (
  fileContent: string,
  startingId: number = 1,
): CustomerPointsParseResult => {
  const trimmedContent = fileContent.trim();

  if (trimmedContent.startsWith("{")) {
    try {
      const geoJson = JSON.parse(fileContent);
      if (geoJson.type === "FeatureCollection") {
        return parseGeoJSONToCustomerPoints(geoJson, startingId);
      }
    } catch (error) {}
  }

  return parseGeoJSONLToCustomerPoints(fileContent, startingId);
};
