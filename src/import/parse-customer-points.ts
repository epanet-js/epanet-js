import { Feature, FeatureCollection, Position } from "geojson";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { CustomerPointsIssuesAccumulator } from "./parse-customer-points-issues";
import { convertTo, Unit } from "src/quantity";

export function* parseCustomerPoints(
  fileContent: string,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  startingId: number = 1,
): Generator<CustomerPoint | null, void, unknown> {
  const trimmedContent = fileContent.trim();

  if (trimmedContent.startsWith("{")) {
    try {
      const geoJson = JSON.parse(fileContent);
      if (geoJson.type === "FeatureCollection") {
        yield* parseGeoJSONFeatures(
          geoJson,
          issues,
          demandImportUnit,
          demandTargetUnit,
          startingId,
        );
        return;
      }
    } catch (error) {}
  }

  yield* parseGeoJSONLFeatures(
    fileContent,
    issues,
    demandImportUnit,
    demandTargetUnit,
    startingId,
  );
}

function* parseGeoJSONFeatures(
  geoJson: FeatureCollection,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  startingId: number = 1,
): Generator<CustomerPoint | null, void, unknown> {
  if (!geoJson || geoJson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: must be a FeatureCollection");
  }

  let currentId = startingId;

  for (const feature of geoJson.features || []) {
    const result = processGeoJSONFeature(
      feature,
      currentId,
      issues,
      demandImportUnit,
      demandTargetUnit,
    );
    yield result.customerPoint;
    currentId = result.nextId;
  }
}

function* parseGeoJSONLFeatures(
  geoJsonLText: string,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  startingId: number = 1,
): Generator<CustomerPoint | null, void, unknown> {
  const lines = geoJsonLText.split("\n").filter((line) => line.trim());
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
          currentId,
          issues,
          demandImportUnit,
          demandTargetUnit,
        );
        yield result.customerPoint;
        currentId = result.nextId;
      }
    } catch (error) {
      yield null;
    }
  }
}

type ProcessFeatureResult = {
  customerPoint: CustomerPoint | null;
  nextId: number;
};

const processGeoJSONFeature = (
  feature: Feature,
  currentId: number,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
): ProcessFeatureResult => {
  if (feature.geometry.type !== "Point") {
    issues.addSkippedNonPoint(feature);
    return {
      customerPoint: null,
      nextId: currentId,
    };
  }

  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    issues.addSkippedInvalidCoordinates(feature);
    return {
      customerPoint: null,
      nextId: currentId,
    };
  }

  try {
    const demandInSourceUnit =
      typeof feature.properties?.demand === "number"
        ? feature.properties.demand
        : 0;

    const demandInTargetUnit = convertTo(
      { value: demandInSourceUnit, unit: demandImportUnit },
      demandTargetUnit,
    );

    const customerPoint = CustomerPoint.build(
      currentId.toString(),
      [coordinates[0], coordinates[1]] as Position,
      { baseDemand: demandInTargetUnit },
    );

    return { customerPoint, nextId: currentId + 1 };
  } catch (error) {
    issues.addSkippedCreationFailure(feature);
    return {
      customerPoint: null,
      nextId: currentId,
    };
  }
};
