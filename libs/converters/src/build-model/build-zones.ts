import type { MultiPolygon } from "geojson";
import type { ZoneData } from "../network-data";
import type {
  CustomAttributeId,
  CustomAttributeType,
  ZoneFactory,
  Zones,
} from "@epanet-js/hydraulic-model";

export type MergedZoneInfo = {
  label: string;
  featureCount: number;
};

export type RenamedZoneInfo = {
  label: string;
  originalLabel: string;
};

export type BuildZonesResult = {
  zones: Zones;
  mergedZones: MergedZoneInfo[];
  renamedZones: RenamedZoneInfo[];
};

export type ZoneAttributePlan = Map<
  string,
  { id: CustomAttributeId; type: CustomAttributeType }
>;

type AttributeValue = string | number;

type Group = {
  label: string | undefined;
  records: ZoneData[];
  values: Map<CustomAttributeId, AttributeValue>;
};

export const buildZones = (
  records: ZoneData[],
  zoneFactory: ZoneFactory,
  attributes: ZoneAttributePlan = new Map(),
): BuildZonesResult => {
  const zones: Zones = new Map();
  const mergedZones: MergedZoneInfo[] = [];
  const renamedZones: RenamedZoneInfo[] = [];

  const groups: Group[] = [];
  const groupsByLabel = new Map<string, Group[]>();

  for (const record of records) {
    const values = resolveValues(record, attributes);

    if (record.label === undefined) {
      groups.push({ label: undefined, records: [record], values });
      continue;
    }

    const key = record.label.toUpperCase();
    const sameLabel = groupsByLabel.get(key) ?? [];
    const group = sameLabel.find((candidate) => !conflicts(candidate, values));
    if (group) {
      group.records.push(record);
      for (const [id, value] of values) group.values.set(id, value);
      continue;
    }

    const created: Group = { label: record.label, records: [record], values };
    sameLabel.push(created);
    groupsByLabel.set(key, sameLabel);
    groups.push(created);
  }

  for (const group of groups) {
    const geometry: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: group.records.flatMap((record) => record.polygons),
    };
    const zone = zoneFactory.create(geometry, group.label);
    for (const [id, value] of group.values) zone.setProperty(id, value);
    zones.set(zone.id, zone);

    if (group.records.length > 1) {
      mergedZones.push({
        label: zone.label,
        featureCount: group.records.length,
      });
    }
    if (group.label !== undefined && zone.label !== group.label) {
      renamedZones.push({ label: zone.label, originalLabel: group.label });
    }
  }

  return { zones, mergedZones, renamedZones };
};

const resolveValues = (
  record: ZoneData,
  attributes: ZoneAttributePlan,
): Map<CustomAttributeId, AttributeValue> => {
  const values = new Map<CustomAttributeId, AttributeValue>();
  for (const [ref, raw] of Object.entries(record.customAttributes ?? {})) {
    const attribute = attributes.get(ref);
    if (!attribute) continue;

    const value = convert(raw, attribute.type);
    if (value !== null) values.set(attribute.id, value);
  }
  return values;
};

const convert = (
  value: AttributeValue,
  type: CustomAttributeType,
): AttributeValue | null => {
  if (type === "text") return String(value);
  if (typeof value === "number") return value;

  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const conflicts = (
  group: Group,
  values: Map<CustomAttributeId, AttributeValue>,
): boolean => {
  for (const [id, value] of values) {
    const existing = group.values.get(id);
    if (existing !== undefined && existing !== value) return true;
  }
  return false;
};
