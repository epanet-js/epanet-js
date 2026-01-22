import { Feature, FeatureCollection, Position } from "geojson";
import {
  CustomerPoint,
  MAX_CUSTOMER_POINT_LABEL_LENGTH,
} from "src/hydraulic-model/customer-points";
import { CustomerPointsIssuesAccumulator } from "./parse-customer-points-issues";
import { convertTo, Unit } from "src/quantity";

export function* parseCustomerPoints(
  fileContent: string,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  startingId: number = 1,
  demandPropertyName: string = "demand",
  labelPropertyName: string | null = null,
  patternId: string | null = null,
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
          demandPropertyName,
          labelPropertyName,
          patternId,
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
    demandPropertyName,
    labelPropertyName,
    patternId,
  );
}

function* parseGeoJSONFeatures(
  geoJson: FeatureCollection,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  startingId: number = 1,
  demandPropertyName: string = "demand",
  labelPropertyName: string | null = null,
  patternId: string | null = null,
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
      demandPropertyName,
      labelPropertyName,
      patternId,
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
  demandPropertyName: string = "demand",
  labelPropertyName: string | null = null,
  patternId: string | null = null,
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
          demandPropertyName,
          labelPropertyName,
          patternId,
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
  demandPropertyName: string = "demand",
  labelPropertyName: string | null = null,
  patternId: string | null = null,
): ProcessFeatureResult => {
  if (!feature.geometry || feature.geometry.type !== "Point") {
    if (!feature.geometry) {
      issues.addSkippedMissingCoordinates(feature);
    } else {
      issues.addSkippedNonPoint(feature);
    }
    return {
      customerPoint: null,
      nextId: currentId,
    };
  }

  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    issues.addSkippedMissingCoordinates(feature);
    return {
      customerPoint: null,
      nextId: currentId,
    };
  }

  const [lng, lat] = coordinates;
  if (!isValidWGS84Coordinates(lng, lat)) {
    issues.addSkippedInvalidProjection(feature);
    return {
      customerPoint: null,
      nextId: currentId,
    };
  }

  const demandValue = feature.properties?.[demandPropertyName];
  if (demandValue === null || demandValue === undefined) {
    issues.addSkippedInvalidDemand(feature);
    return {
      customerPoint: null,
      nextId: currentId,
    };
  }

  if (typeof demandValue === "boolean") {
    issues.addSkippedInvalidDemand(feature);
    return {
      customerPoint: null,
      nextId: currentId,
    };
  }

  const demandInSourceUnit = Number(demandValue);
  if (isNaN(demandInSourceUnit)) {
    issues.addSkippedInvalidDemand(feature);
    return {
      customerPoint: null,
      nextId: currentId,
    };
  }

  try {
    const demandInTargetUnit = convertTo(
      { value: demandInSourceUnit, unit: demandImportUnit },
      demandTargetUnit,
    );

    const id = currentId;
    let label = String(id);

    if (labelPropertyName && feature.properties) {
      const labelValue = feature.properties[labelPropertyName];
      if (labelValue != null && labelValue !== "") {
        label = String(labelValue).substring(
          0,
          MAX_CUSTOMER_POINT_LABEL_LENGTH,
        );
      }
    }

    const customerPoint = CustomerPoint.build(
      id,
      [coordinates[0], coordinates[1]] as Position,
      {
        baseDemand: demandInTargetUnit,
        label,
        demands: [
          patternId
            ? { baseDemand: demandInTargetUnit, patternLabel: patternId }
            : { baseDemand: demandInTargetUnit },
        ],
      },
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

const isValidWGS84Coordinates = (lng: number, lat: number): boolean => {
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
};
