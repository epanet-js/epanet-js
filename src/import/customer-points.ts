import { Feature, FeatureCollection, Position } from "geojson";
import {
  CustomerPoint,
  CustomerPoints,
  initializeCustomerPoints,
} from "src/hydraulic-model/customer-points";
import {
  CustomerPointsParserIssues,
  CustomerPointsIssuesAccumulator,
} from "./customer-points-issues";
import { connectCustomerPoint } from "src/hydraulic-model/model-operations/connect-customer-points";
import { SpatialIndexData } from "src/hydraulic-model/spatial-index";
import { AssetsMap } from "src/hydraulic-model/assets-map";

export type CustomerPointsStreamingParseResult = {
  customerPoints: CustomerPoints;
  issues: CustomerPointsParserIssues | null;
};

type ProcessFeatureResult = {
  customerPoint: CustomerPoint | null;
  nextId: number;
};

export const parseCustomerPointsStreamingFromFile = (
  fileContent: string,
  spatialIndexData: SpatialIndexData,
  assets: AssetsMap,
  startingId: number = 1,
): CustomerPointsStreamingParseResult => {
  const trimmedContent = fileContent.trim();

  if (trimmedContent.startsWith("{")) {
    try {
      const geoJson = JSON.parse(fileContent);
      if (geoJson.type === "FeatureCollection") {
        return parseGeoJSONToCustomerPoints(
          geoJson,
          spatialIndexData,
          assets,
          startingId,
        );
      }
    } catch (error) {}
  }

  return parseGeoJSONLToCustomerPoints(
    fileContent,
    spatialIndexData,
    assets,
    startingId,
  );
};

const parseGeoJSONToCustomerPoints = (
  geoJson: FeatureCollection,
  spatialIndexData: SpatialIndexData,
  assets: AssetsMap,
  startingId: number = 1,
): CustomerPointsStreamingParseResult => {
  if (!geoJson || geoJson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: must be a FeatureCollection");
  }

  const customerPoints = initializeCustomerPoints();
  const issues = new CustomerPointsIssuesAccumulator();
  let currentId = startingId;

  for (const feature of geoJson.features || []) {
    const result = processGeoJSONFeature(
      feature,
      spatialIndexData,
      assets,
      currentId,
      issues,
    );

    if (result.customerPoint) {
      customerPoints.set(result.customerPoint.id, result.customerPoint);
    }

    currentId = result.nextId;
  }

  return {
    customerPoints,
    issues: issues.buildResult(),
  };
};

const parseGeoJSONLToCustomerPoints = (
  geoJsonLText: string,
  spatialIndexData: SpatialIndexData,
  assets: AssetsMap,
  startingId: number = 1,
): CustomerPointsStreamingParseResult => {
  const lines = geoJsonLText.split("\n").filter((line) => line.trim());
  const customerPoints = initializeCustomerPoints();
  const issues = new CustomerPointsIssuesAccumulator();
  let currentId = startingId;

  for (const line of lines) {
    try {
      const json = JSON.parse(line);

      if (json.type === "metadata") {
        continue;
      }

      if (json.type === "Feature") {
        const result = processGeoJSONFeature(
          json,
          spatialIndexData,
          assets,
          currentId,
          issues,
        );

        if (result.customerPoint) {
          customerPoints.set(result.customerPoint.id, result.customerPoint);
        }

        currentId = result.nextId;
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

const processGeoJSONFeature = (
  feature: Feature,
  spatialIndexData: SpatialIndexData,
  assets: AssetsMap,
  currentId: number,
  issues: CustomerPointsIssuesAccumulator,
): ProcessFeatureResult => {
  if (feature.geometry.type !== "Point") {
    issues.addSkippedNonPoint();
    return { customerPoint: null, nextId: currentId };
  }

  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    issues.addSkippedInvalidCoordinates();
    return { customerPoint: null, nextId: currentId };
  }

  try {
    const demand =
      typeof feature.properties?.demand === "number"
        ? feature.properties.demand
        : 0;

    const customerPoint = new CustomerPoint(
      currentId.toString(),
      [coordinates[0], coordinates[1]] as Position,
      { baseDemand: demand },
    );

    const connection = connectCustomerPoint(
      customerPoint,
      spatialIndexData,
      assets,
    );

    if (connection) {
      customerPoint.connect(connection);
      return { customerPoint, nextId: currentId + 1 };
    } else {
      issues.addSkippedNoValidJunction();
      return { customerPoint: null, nextId: currentId + 1 };
    }
  } catch (error) {
    issues.addSkippedCreationFailure();
    return { customerPoint: null, nextId: currentId };
  }
};
