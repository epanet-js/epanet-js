import type { Feature, Position } from "geojson";
import {
  resolveCustomAttributeValues,
  type CustomAttributePlan,
  type CustomerPointData,
} from "@epanet-js/converters";
import {
  CustomerPointFactory,
  CustomerPoint,
  CustomerPointId,
  Demand,
  LabelManager,
  PatternId,
} from "@epanet-js/hydraulic-model";
import { CustomerPointsIssuesAccumulator } from "./issues";
import { createTimeSlicer } from "src/infra/yield-to-main";
import { throwIfAborted } from "src/infra/abort";

export type BuildCustomerPointsOptions = {
  factory: CustomerPointFactory;
  toDemand: (value: number) => number;
  patternId: PatternId | null;
  defaultDemand: number | null;
  labelMaxLength?: number;
  attributes?: CustomAttributePlan;
  issues: CustomerPointsIssuesAccumulator;
  createLimit?: number;
  onProgress?: (processed: number, total: number) => void;
  signal?: AbortSignal;
};

export type BuiltCustomerPoints = {
  customerPoints: CustomerPoint[];
  demands: Map<CustomerPointId, Demand[]>;
  validCount: number;
};

// Minting an id and a label per point costs roughly eight allocations, so a
// large source is seconds of work — batched with a yield between batches so the
// wizard keeps painting, and abandoned outright once it is superseded.

// The clock is only read at a batch boundary, so a batch has to stay well under
// the slice or it, rather than the slice, decides when we yield. A point costs
// ~7µs, so this is ~3.5ms of work.
const RECORDS_PER_BATCH = 512;

export const buildCustomerPoints = async (
  records: CustomerPointData[],
  features: Feature[],
  {
    factory,
    toDemand,
    patternId,
    defaultDemand,
    labelMaxLength,
    attributes = new Map(),
    issues,
    createLimit = Infinity,
    onProgress,
    signal,
  }: BuildCustomerPointsOptions,
): Promise<BuiltCustomerPoints> => {
  throwIfAborted(signal);

  const customerPoints: CustomerPoint[] = [];
  const demands = new Map<CustomerPointId, Demand[]>();
  let uncreatedCount = 0;
  const sliceIfDue = createTimeSlicer();

  for (let start = 0; start < records.length; start += RECORDS_PER_BATCH) {
    const stop = Math.min(start + RECORDS_PER_BATCH, records.length);

    for (let index = start; index < stop; index++) {
      const record = records[index];
      const feature = features[Number(record.ref)];
      const coordinates = record.coordinates;

      if (!isWgs84(coordinates)) {
        issues.addSkippedInvalidProjection(featureFor(feature, record));
        continue;
      }

      if (customerPoints.length >= createLimit) {
        uncreatedCount++;
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
        for (const [id, value] of resolveCustomAttributeValues(
          record,
          attributes,
        )) {
          customerPoint.setProperty(id, value);
        }
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

    onProgress?.(stop, records.length);
    await sliceIfDue();
    throwIfAborted(signal);
  }

  return {
    customerPoints,
    demands,
    validCount: customerPoints.length + uncreatedCount,
  };
};

const isWgs84 = ([longitude, latitude]: Position): boolean =>
  longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;

const featureFor = (
  feature: Feature | undefined,
  record: CustomerPointData,
): Feature =>
  feature ?? {
    type: "Feature",
    geometry: { type: "Point", coordinates: record.coordinates },
    properties: null,
  };
