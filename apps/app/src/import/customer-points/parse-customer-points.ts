import { Feature, FeatureCollection, Position } from "geojson";
import {
  MAX_CUSTOMER_POINT_LABEL_LENGTH,
  CustomerPointFactory,
} from "@epanet-js/hydraulic-model";
import { CustomerPointsIssuesAccumulator } from "./parse-customer-points-issues";
import { convertTo, Unit } from "@epanet-js/quantity";
import { Demand, PatternId } from "src/hydraulic-model";

export type ParsedCustomerPoint = {
  customerPoint: ReturnType<CustomerPointFactory["create"]>;
  demands: Demand[];
};

export function* parseCustomerPoints(
  fileContent: string,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  customerPointFactory: CustomerPointFactory,
  demandPropertyName: string | null = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
  defaultDemand: number = 0,
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
          customerPointFactory,
          demandPropertyName,
          labelPropertyName,
          patternId,
          defaultDemand,
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
    customerPointFactory,
    demandPropertyName,
    labelPropertyName,
    patternId,
    defaultDemand,
  );
}

function* parseGeoJSONFeatures(
  geoJson: FeatureCollection,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  customerPointFactory: CustomerPointFactory,
  demandPropertyName: string | null = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
  defaultDemand: number = 0,
): Generator<ParsedCustomerPoint | null, void, unknown> {
  if (!geoJson || geoJson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: must be a FeatureCollection");
  }

  for (const feature of geoJson.features || []) {
    yield processGeoJSONFeature(
      feature,
      customerPointFactory,
      issues,
      demandImportUnit,
      demandTargetUnit,
      demandPropertyName,
      labelPropertyName,
      patternId,
      defaultDemand,
    );
  }
}

function* parseGeoJSONLFeatures(
  geoJsonLText: string,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  customerPointFactory: CustomerPointFactory,
  demandPropertyName: string | null = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
  defaultDemand: number = 0,
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
          customerPointFactory,
          issues,
          demandImportUnit,
          demandTargetUnit,
          demandPropertyName,
          labelPropertyName,
          patternId,
          defaultDemand,
        );
      }
    } catch (error) {
      yield null;
    }
  }
}

const processGeoJSONFeature = (
  feature: Feature,
  customerPointFactory: CustomerPointFactory,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  demandPropertyName: string | null = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
  defaultDemand: number = 0,
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

  let demandInSourceUnit: number;
  if (demandPropertyName) {
    const demandValue = feature.properties?.[demandPropertyName];
    if (demandValue === null || demandValue === undefined) {
      issues.addSkippedInvalidDemand(feature);
      return null;
    }

    if (typeof demandValue === "boolean") {
      issues.addSkippedInvalidDemand(feature);
      return null;
    }

    demandInSourceUnit = Number(demandValue);
    if (isNaN(demandInSourceUnit)) {
      issues.addSkippedInvalidDemand(feature);
      return null;
    }
  } else {
    demandInSourceUnit = defaultDemand;
  }

  try {
    const demandInTargetUnit = convertTo(
      { value: demandInSourceUnit, unit: demandImportUnit },
      demandTargetUnit,
    );

    let label: string | undefined;

    if (labelPropertyName && feature.properties) {
      const labelValue = feature.properties[labelPropertyName];
      if (labelValue != null && labelValue !== "") {
        label = String(labelValue).substring(
          0,
          MAX_CUSTOMER_POINT_LABEL_LENGTH,
        );
      }
    }

    const customerPoint = customerPointFactory.create(
      [coordinates[0], coordinates[1]] as Position,
      label,
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
