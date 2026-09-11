import type { Feature, Position } from "geojson";
import {
  IssueCollector,
  type CustomAttributeData,
  type CustomAttributeValues,
  type CustomerPointData,
} from "@epanet-js/converters";
import type { GisInput, ImportOptions, ImportResult } from "../importer";
import type { ImportConfig } from "../import-config";
import { parseGisSource } from "../file-parsers/parse-gis-source";
import { createTimeSlicer, throwIfAborted } from "../time-slice";

export type CustomerPointRole = "label" | "demand";

// Reading a point is a handful of property lookups, so a batch this size is well
// under a slice and the slice stays the thing that decides when to yield.
const RECORDS_PER_BATCH = 4096;

export const importCustomerPointsFromFeatures = async (
  features: Feature[],
  config: ImportConfig<CustomerPointRole> = {},
  { signal }: ImportOptions = {},
): Promise<ImportResult> => {
  throwIfAborted(signal);

  const issues = new IssueCollector();
  const collected = issues.build();

  const labelProperty = config.mapping?.label ?? null;
  const demandProperty = config.mapping?.demand ?? null;
  const limit = config.recordLimit ?? features.length;

  const customerPoints: CustomerPointData[] = [];
  const customAttributeNames = config.customAttributes ?? [];

  const end = Math.min(features.length, limit);
  const sliceIfDue = createTimeSlicer();

  for (let start = 0; start < end; start += RECORDS_PER_BATCH) {
    const stop = Math.min(start + RECORDS_PER_BATCH, end);

    for (let index = start; index < stop; index++) {
      const point = importFeature(
        features[index],
        String(index),
        { labelProperty, demandProperty, customAttributeNames },
        issues,
      );
      if (point !== null) customerPoints.push(point);
    }

    await sliceIfDue();
    throwIfAborted(signal);
  }

  return {
    network: {
      customerPoints,
      customAttributes: declarations(customAttributeNames, customerPoints),
      ...(config.units === undefined ? {} : { units: config.units }),
    },
    issues: collected,
  };
};

export const importCustomerPointsFromSource = async (
  input: GisInput &
    ImportOptions & { config?: ImportConfig<CustomerPointRole> },
): Promise<ImportResult> => {
  const { features, issues } = await parseGisSource(input);
  const parsed = issues.build();

  if (features.length === 0) return { network: {}, issues: parsed };

  const placed = !parsed.some(({ severity }) => severity === "error");
  const { network, issues: interpreted } =
    await importCustomerPointsFromFeatures(features, input.config ?? {}, {
      signal: input.signal,
    });

  return {
    network: {
      ...network,
      crs: placed ? { type: "epsg", code: 4326 } : { type: "unknown" },
    },
    issues: [...parsed, ...interpreted],
  };
};

type ReadOptions = {
  labelProperty: string | null;
  demandProperty: string | null;
  customAttributeNames: string[];
};

const importFeature = (
  feature: Feature,
  ref: string,
  { labelProperty, demandProperty, customAttributeNames }: ReadOptions,
  issues: IssueCollector,
): CustomerPointData | null => {
  const geometry = feature.geometry;

  if (!geometry) {
    issues.add({
      code: "featureGeometryMissing",
      severity: "warning",
      ref,
      raw: feature,
    });
    return null;
  }

  if (geometry.type !== "Point") {
    issues.add({
      code: "featureGeometryUnsupported",
      severity: "warning",
      ref,
      context: { geometry: geometry.type },
      raw: feature,
    });
    return null;
  }

  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    issues.add({
      code: "featureGeometryMissing",
      severity: "warning",
      ref,
      raw: feature,
    });
    return null;
  }

  const [x, y] = coordinates;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    issues.add({
      code: "featureCoordinatesInvalid",
      severity: "warning",
      ref,
      raw: feature,
    });
    return null;
  }

  const point: CustomerPointData = {
    ref,
    coordinates: [x, y] as Position,
  };

  const label = readLabel(feature, labelProperty);
  if (label !== null) point.label = label;

  const demand = readDemand(feature, demandProperty, ref, issues);
  if (demand !== null) point.demands = [{ baseDemand: demand }];

  const customAttributes = readCustomAttributes(feature, customAttributeNames);
  if (customAttributes !== null) point.customAttributes = customAttributes;

  return point;
};

const readLabel = (
  feature: Feature,
  property: string | null,
): string | null => {
  if (property === null) return null;

  const value: unknown = feature.properties?.[property];
  if (value === null || value === undefined || value === "") return null;

  return String(value);
};

const readDemand = (
  feature: Feature,
  property: string | null,
  ref: string,
  issues: IssueCollector,
): number | null => {
  if (property === null) return null;

  const value: unknown = feature.properties?.[property];
  const blank = value === null || value === undefined || value === "";

  if (blank || typeof value === "boolean" || isNaN(Number(value))) {
    issues.add({
      code: "attributeValueUnreadable",
      severity: "warning",
      ref,
      context: { attribute: property },
      raw: feature,
    });
    return null;
  }

  return Number(value);
};

const readCustomAttributes = (
  feature: Feature,
  names: string[],
): CustomAttributeValues | null => {
  const values: CustomAttributeValues = {};
  let stated = false;

  for (const name of names) {
    const value: unknown = feature.properties?.[name];
    if (value === null || value === undefined || value === "") continue;

    values[name] = typeof value === "number" ? value : String(value);
    stated = true;
  }

  return stated ? values : null;
};

const declarations = (
  names: string[],
  points: CustomerPointData[],
): CustomAttributeData[] =>
  names
    .filter((name) =>
      points.some((point) => point.customAttributes?.[name] !== undefined),
    )
    .map((name) => ({
      ref: name,
      name,
      type: points.every((point) => {
        const value = point.customAttributes?.[name];
        return value === undefined || typeof value === "number";
      })
        ? ("number" as const)
        : ("text" as const),
    }));
