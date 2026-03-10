import { Feature, FeatureCollection, Position } from "geojson";
import {
  CustomerPoint,
  MAX_CUSTOMER_POINT_LABEL_LENGTH,
} from "src/hydraulic-model/customer-points";
import { CustomerPointsIssuesAccumulator } from "./parse-customer-points-issues";
import { convertTo, Unit } from "src/quantity";
import { Demand, PatternId } from "src/hydraulic-model";
import { IdGenerator } from "src/hydraulic-model/id-generator";

export type ParsedCustomerPoint = {
  customerPoint: CustomerPoint;
  demands: Demand[];
};

export function* parseCustomerPoints(
  fileContent: string,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  idGenerator: IdGenerator,
  demandPropertyName: string = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
): Generator<ParsedCustomerPoint | null, void, unknown> {
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
          idGenerator,
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
    idGenerator,
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
  idGenerator: IdGenerator,
  demandPropertyName: string = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
): Generator<ParsedCustomerPoint | null, void, unknown> {
  if (!geoJson || geoJson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: must be a FeatureCollection");
  }

  for (const feature of geoJson.features || []) {
    yield processGeoJSONFeature(
      feature,
      idGenerator,
      issues,
      demandImportUnit,
      demandTargetUnit,
      demandPropertyName,
      labelPropertyName,
      patternId,
    );
  }
}

function* parseGeoJSONLFeatures(
  geoJsonLText: string,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  idGenerator: IdGenerator,
  demandPropertyName: string = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
): Generator<ParsedCustomerPoint | null, void, unknown> {
  const lines = geoJsonLText.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    try {
      const json = JSON.parse(line);

      if (json.type === "metadata") {
        continue;
      }

      if (json.type === "Feature") {
        yield processGeoJSONFeature(
          json,
          idGenerator,
          issues,
          demandImportUnit,
          demandTargetUnit,
          demandPropertyName,
          labelPropertyName,
          patternId,
        );
      }
    } catch (error) {
      yield null;
    }
  }
}

const processGeoJSONFeature = (
  feature: Feature,
  idGenerator: IdGenerator,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  demandPropertyName: string = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
): ParsedCustomerPoint | null => {
  if (!feature.geometry || feature.geometry.type !== "Point") {
    if (!feature.geometry) {
      issues.addSkippedMissingCoordinates(feature);
    } else {
      issues.addSkippedNonPoint(feature);
    }
    return null;
  }

  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    issues.addSkippedMissingCoordinates(feature);
    return null;
  }

  const [lng, lat] = coordinates;
  if (!isValidWGS84Coordinates(lng, lat)) {
    issues.addSkippedInvalidProjection(feature);
    return null;
  }

  const demandValue = feature.properties?.[demandPropertyName];
  if (demandValue === null || demandValue === undefined) {
    issues.addSkippedInvalidDemand(feature);
    return null;
  }

  if (typeof demandValue === "boolean") {
    issues.addSkippedInvalidDemand(feature);
    return null;
  }

  const demandInSourceUnit = Number(demandValue);
  if (isNaN(demandInSourceUnit)) {
    issues.addSkippedInvalidDemand(feature);
    return null;
  }

  try {
    const demandInTargetUnit = convertTo(
      { value: demandInSourceUnit, unit: demandImportUnit },
      demandTargetUnit,
    );

    const id = idGenerator.newId();
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
      { label },
    );

    const demands: Demand[] = [
      patternId
        ? { baseDemand: demandInTargetUnit, patternId }
        : { baseDemand: demandInTargetUnit },
    ];

    return { customerPoint, demands };
  } catch (error) {
    issues.addSkippedCreationFailure(feature);
    return null;
  }
};

const isValidWGS84Coordinates = (lng: number, lat: number): boolean => {
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
};
