import { Feature, FeatureCollection, Position } from "geojson";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { CustomerPointsIssuesAccumulator } from "./parse-customer-points-issues";

type ProcessFeatureResult = {
  customerPoint: CustomerPoint | null;
  nextId: number;
};

export function* parseCustomerPoints(
  fileContent: string,
  issues: CustomerPointsIssuesAccumulator,
  startingId: number = 1,
): Generator<CustomerPoint, void, unknown> {
  const trimmedContent = fileContent.trim();

  if (trimmedContent.startsWith("{")) {
    try {
      const geoJson = JSON.parse(fileContent);
      if (geoJson.type === "FeatureCollection") {
        yield* parseGeoJSONFeatures(geoJson, issues, startingId);
        return;
      }
    } catch (error) {}
  }

  yield* parseGeoJSONLFeatures(fileContent, issues, startingId);
}

function* parseGeoJSONFeatures(
  geoJson: FeatureCollection,
  issues: CustomerPointsIssuesAccumulator,
  startingId: number = 1,
): Generator<CustomerPoint, void, unknown> {
  if (!geoJson || geoJson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: must be a FeatureCollection");
  }

  let currentId = startingId;

  for (const feature of geoJson.features || []) {
    const result = processGeoJSONFeatureForParsing(feature, currentId, issues);

    if (result.customerPoint) {
      yield result.customerPoint;
    }

    currentId = result.nextId;
  }
}

function* parseGeoJSONLFeatures(
  geoJsonLText: string,
  issues: CustomerPointsIssuesAccumulator,
  startingId: number = 1,
): Generator<CustomerPoint, void, unknown> {
  const lines = geoJsonLText.split("\n").filter((line) => line.trim());
  let currentId = startingId;

  for (const line of lines) {
    try {
      const json = JSON.parse(line);

      if (json.type === "metadata") {
        continue;
      }

      if (json.type === "Feature") {
        const result = processGeoJSONFeatureForParsing(json, currentId, issues);

        if (result.customerPoint) {
          yield result.customerPoint;
        }

        currentId = result.nextId;
      }
    } catch (error) {
      issues.addSkippedInvalidLine();
    }
  }
}

const processGeoJSONFeatureForParsing = (
  feature: Feature,
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

    return { customerPoint, nextId: currentId + 1 };
  } catch (error) {
    issues.addSkippedCreationFailure();
    return { customerPoint: null, nextId: currentId };
  }
};
