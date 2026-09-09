import type { Feature, Position } from "geojson";
import type { CustomerPointData } from "@epanet-js/converters";
import {
  CustomerPointFactory,
  CustomerPoint,
  CustomerPointId,
  Demand,
  LabelManager,
  PatternId,
} from "@epanet-js/hydraulic-model";
import { CustomerPointsIssuesAccumulator } from "@epanet-js/gis-importers";
import type { Placement } from "src/hooks/use-placement";

export type BuildCustomerPointsOptions = {
  factory: CustomerPointFactory;
  placement: Placement;
  toDemand: (value: number) => number;
  patternId: PatternId | null;
  defaultDemand: number | null;
  labelMaxLength?: number;
  issues: CustomerPointsIssuesAccumulator;
};

export type BuiltCustomerPoints = {
  customerPoints: CustomerPoint[];
  demands: Map<CustomerPointId, Demand[]>;
};

export const buildCustomerPoints = (
  records: CustomerPointData[],
  features: Feature[],
  {
    factory,
    placement,
    toDemand,
    patternId,
    defaultDemand,
    labelMaxLength,
    issues,
  }: BuildCustomerPointsOptions,
): BuiltCustomerPoints => {
  const customerPoints: CustomerPoint[] = [];
  const demands = new Map<CustomerPointId, Demand[]>();

  for (const record of records) {
    const feature = features[Number(record.ref)];
    const coordinates = place(record.coordinates, placement);

    if (coordinates === null) {
      issues.addSkippedInvalidProjection(featureFor(feature, record));
      continue;
    }

    const baseDemand = record.demands?.[0]?.baseDemand ?? defaultDemand;
    const label =
      record.label === undefined
        ? undefined
        : LabelManager.sanitizeLabel(
            record.label,
            "customerPoint",
            labelMaxLength,
          );

    try {
      const customerPoint = factory.create(coordinates, label);
      customerPoints.push(customerPoint);
      demands.set(
        customerPoint.id,
        baseDemand === null
          ? []
          : [
              patternId
                ? { baseDemand: toDemand(baseDemand), patternId }
                : { baseDemand: toDemand(baseDemand) },
            ],
      );
    } catch {
      issues.addSkippedCreationFailure(featureFor(feature, record));
    }
  }

  return { customerPoints, demands };
};

const place = (
  coordinates: Position,
  placement: Placement,
): Position | null => {
  if (placement.kind === "transform") return placement.toWgs84(coordinates);

  const [longitude, latitude] = coordinates;
  const inRange =
    longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;

  return inRange ? coordinates : null;
};

const featureFor = (
  feature: Feature | undefined,
  record: CustomerPointData,
): Feature =>
  feature ?? {
    type: "Feature",
    geometry: { type: "Point", coordinates: record.coordinates },
    properties: null,
  };
