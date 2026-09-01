import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Position,
} from "geojson";
import {
  LabelManager,
  CustomerPointFactory,
  Demand,
  PatternId,
} from "@epanet-js/hydraulic-model";
import { CustomerPointsIssuesAccumulator } from "./parse-customer-points-issues";
import { convertTo, Unit } from "@epanet-js/quantity";

export type ParsedCustomerPoint = {
  customerPoint: ReturnType<CustomerPointFactory["create"]>;
  demands: Demand[];
  properties: GeoJsonProperties;
};

// Reads `.type` exactly as a bare member access would, throwing on null the way
// the callers' try/catch already relies on.
const typeOf = (value: unknown): unknown => (value as { type?: unknown }).type;

export function* parseCustomerPoints(
  fileContent: string,
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  customerPointFactory: CustomerPointFactory,
  demandPropertyName: string | null = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
  defaultDemand: number | null = null,
  labelMaxLength?: number,
): Generator<ParsedCustomerPoint | null, void, unknown> {
  const trimmedContent = fileContent.trim();

  if (trimmedContent.startsWith("{")) {
    try {
      const geoJson: unknown = JSON.parse(fileContent);
      if (typeOf(geoJson) === "FeatureCollection") {
        yield* parseCustomerPointFeatures(
          (geoJson as FeatureCollection).features ?? [],
          issues,
          demandImportUnit,
          demandTargetUnit,
          customerPointFactory,
          demandPropertyName,
          labelPropertyName,
          patternId,
          defaultDemand,
          labelMaxLength,
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
    labelMaxLength,
  );
}

export function* parseCustomerPointFeatures(
  features: Feature[],
  issues: CustomerPointsIssuesAccumulator,
  demandImportUnit: Unit,
  demandTargetUnit: Unit,
  customerPointFactory: CustomerPointFactory,
  demandPropertyName: string | null = "demand",
  labelPropertyName: string | null = null,
  patternId: PatternId | null = null,
  defaultDemand: number | null = null,
  labelMaxLength?: number,
): Generator<ParsedCustomerPoint | null, void, unknown> {
  for (const feature of features) {
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
      labelMaxLength,
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
  defaultDemand: number | null = null,
  labelMaxLength?: number,
): Generator<ParsedCustomerPoint | null, void, unknown> {
  const lines = geoJsonLText.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    try {
      const json: unknown = JSON.parse(line);

      if (typeOf(json) === "metadata") {
        continue;
      }

      if (typeOf(json) === "Feature") {
        yield processGeoJSONFeature(
          json as Feature,
          customerPointFactory,
          issues,
          demandImportUnit,
          demandTargetUnit,
          demandPropertyName,
          labelPropertyName,
          patternId,
          defaultDemand,
          labelMaxLength,
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
  defaultDemand: number | null = null,
  labelMaxLength?: number,
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

  let demandInSourceUnit: number | null;
  if (demandPropertyName) {
    const demandValue: unknown = feature.properties?.[demandPropertyName];
    const isInvalid =
      demandValue === null ||
      demandValue === undefined ||
      typeof demandValue === "boolean" ||
      isNaN(Number(demandValue));

    if (isInvalid) {
      issues.addSkippedInvalidDemand(feature);
      demandInSourceUnit = defaultDemand;
    } else {
      demandInSourceUnit = Number(demandValue);
    }
  } else {
    demandInSourceUnit = defaultDemand;
  }

  try {
    const demandInTargetUnit =
      demandInSourceUnit === null
        ? null
        : convertTo(
            { value: demandInSourceUnit, unit: demandImportUnit },
            demandTargetUnit,
          );

    let label: string | undefined;

    if (labelPropertyName && feature.properties) {
      const labelValue: unknown = feature.properties[labelPropertyName];
      if (labelValue != null && labelValue !== "") {
        label = LabelManager.sanitizeLabel(
          String(labelValue),
          "customerPoint",
          labelMaxLength,
        );
      }
    }

    const customerPoint = customerPointFactory.create(
      [coordinates[0], coordinates[1]] as Position,
      label,
    );

    const demands: Demand[] =
      demandInTargetUnit === null
        ? []
        : [
            patternId
              ? { baseDemand: demandInTargetUnit, patternId }
              : { baseDemand: demandInTargetUnit },
          ];

    return { customerPoint, demands, properties: feature.properties };
  } catch (error) {
    issues.addSkippedCreationFailure(feature);
    return null;
  }
};

const isValidWGS84Coordinates = (lng: number, lat: number): boolean => {
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
};
