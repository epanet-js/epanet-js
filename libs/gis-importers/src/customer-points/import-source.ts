import type { Feature, Position } from "geojson";
import {
  IssueCollector,
  type CustomAttributeData,
  type CustomAttributeValues,
  type CustomerPointData,
  type ParserInput,
} from "@epanet-js/converters";
import type { ImportResult } from "../importer";
import type { ImportConfig } from "../import-config";
import { parseGisSource } from "../file-parsers/parse-gis-source";

export type CustomerPointRole = "label" | "demand";

export const importCustomerPointsSource = async (
  input: ParserInput & { config?: ImportConfig<CustomerPointRole> },
): Promise<ImportResult> => {
  const { features, issues } = await parseGisSource(input);
  const config = input.config ?? {};

  const blocking = issues.build().some(({ severity }) => severity === "error");
  if (blocking) return { network: {}, issues: issues.build() };

  const labelProperty = config.mapping?.label ?? null;
  const demandProperty = config.mapping?.demand ?? null;
  const limit = config.recordLimit ?? features.length;

  const customerPoints: CustomerPointData[] = [];
  const customAttributeNames = config.customAttributes ?? [];

  for (let index = 0; index < features.length && index < limit; index++) {
    const point = importFeature(
      features[index],
      String(index),
      { labelProperty, demandProperty, customAttributeNames },
      issues,
    );
    if (point !== null) customerPoints.push(point);
  }

  return {
    network: {
      customerPoints,
      customAttributes: declarations(customAttributeNames, customerPoints),
      ...(config.units === undefined ? {} : { units: config.units }),
      crs: { type: "epsg", code: 4326 },
    },
    issues: issues.build(),
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
