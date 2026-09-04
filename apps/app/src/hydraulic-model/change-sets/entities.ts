import type { Position } from "geojson";
import {
  type Asset,
  type AssetId,
  type AssetType,
  type CustomAttribute,
  type CustomAttributeAssetType,
  type CustomAttributesDefinition,
  CustomerPoint,
  type CustomerPointConnection,
  type CustomerPointId,
  Junction,
  type JunctionProperties,
  Pipe,
  type PipeProperties,
  Pump,
  type PumpProperties,
  Reservoir,
  type ReservoirProperties,
  Tank,
  type TankProperties,
  Valve,
  type ValveProperties,
} from "@epanet-js/hydraulic-model";
import type { AssetEntityKind, Cell } from "@epanet-js/change-set";

export const TYPE_FIELD = "type";
export const COORDINATES_FIELD = "coordinates";
export const CONNECTIONS_FIELD = "connections";
export const LABEL_FIELD = "label";
export const CONNECTION_FIELD = "connection";
export const AT_FIELD = "at";

export type Fields = Record<string, Cell>;

const assetEntityByType: Record<AssetType, AssetEntityKind> = {
  junction: "junction",
  reservoir: "reservoir",
  tank: "tank",
  pipe: "pipe",
  pump: "pump",
  valve: "valve",
};

const assetTypeByEntity: Record<AssetEntityKind, AssetType> = {
  junction: "junction",
  reservoir: "reservoir",
  tank: "tank",
  pipe: "pipe",
  pump: "pump",
  valve: "valve",
};

export const assetTypeToEntity = (type: AssetType): AssetEntityKind =>
  assetEntityByType[type];

export const entityToAssetType = (entity: AssetEntityKind): AssetType =>
  assetTypeByEntity[entity];

export const assetToFields = (asset: Asset): Fields => {
  const fields: Fields = {
    [COORDINATES_FIELD]: asset.feature.geometry.coordinates,
    [AT_FIELD]: asset.at,
  };
  for (const [key, value] of Object.entries(asset.feature.properties)) {
    if (key === TYPE_FIELD) continue;
    fields[key] = value as Cell;
  }
  return fields;
};

type AssetBuilder = (
  id: AssetId,
  coordinates: Cell,
  properties: Fields,
) => Asset;

const assetBuilders: Record<AssetEntityKind, AssetBuilder> = {
  junction: (id, coordinates, properties) =>
    new Junction(
      id,
      coordinates as Position,
      properties as unknown as JunctionProperties,
    ),
  reservoir: (id, coordinates, properties) =>
    new Reservoir(
      id,
      coordinates as Position,
      properties as unknown as ReservoirProperties,
    ),
  tank: (id, coordinates, properties) =>
    new Tank(
      id,
      coordinates as Position,
      properties as unknown as TankProperties,
    ),
  pipe: (id, coordinates, properties) =>
    new Pipe(
      id,
      coordinates as Position[],
      properties as unknown as PipeProperties,
    ),
  pump: (id, coordinates, properties) =>
    new Pump(
      id,
      coordinates as Position[],
      properties as unknown as PumpProperties,
    ),
  valve: (id, coordinates, properties) =>
    new Valve(
      id,
      coordinates as Position[],
      properties as unknown as ValveProperties,
    ),
};

export const buildAssetFromFields = (
  entity: AssetEntityKind,
  id: AssetId,
  fields: Fields,
): Asset => {
  const {
    [COORDINATES_FIELD]: coordinates,
    [AT_FIELD]: at,
    ...properties
  } = fields;
  const asset = assetBuilders[entity](id, coordinates, {
    ...properties,
    [TYPE_FIELD]: entityToAssetType(entity),
  });
  if (typeof at === "string") (asset as { at: string }).at = at;
  return asset;
};

export const customerPointToFields = (customerPoint: CustomerPoint): Fields => {
  const fields: Fields = {
    [COORDINATES_FIELD]: customerPoint.coordinates,
    [CONNECTION_FIELD]: customerPoint.connection,
  };
  for (const key of customerPoint.listProperties()) {
    fields[key] = customerPoint.getProperty(key) as Cell;
  }
  return fields;
};

export const buildCustomerPointFromFields = (
  id: CustomerPointId,
  fields: Fields,
): CustomerPoint => {
  const {
    [COORDINATES_FIELD]: coordinates,
    [CONNECTION_FIELD]: connection,
    ...properties
  } = fields;

  const customerPoint = new CustomerPoint(
    id,
    coordinates as Position,
    properties as unknown as { label: string },
  );

  if (connection) {
    customerPoint.connect({
      ...(connection as CustomerPointConnection),
    });
  }

  return customerPoint;
};

export const customAttributeKey = (
  assetType: CustomAttributeAssetType,
  id: string,
): string => `${assetType}/${id}`;

export const splitCustomAttributeKey = (
  key: string,
): { assetType: CustomAttributeAssetType; id: string } => {
  const separator = key.indexOf("/");
  return {
    assetType: key.slice(0, separator) as CustomAttributeAssetType,
    id: key.slice(separator + 1),
  };
};

export type PlainCustomAttributes = Record<string, CustomAttribute>;

// The definition is nested `Map`s, and a `Map` in a `WHOLE_VALUE` cell
// JSON.stringifies to `{}` — everything lost, no error. It travels flattened to
// the same `<assetType>/<id>` keys a per-attribute record used.
export const customAttributesToPlain = (
  definition: CustomAttributesDefinition,
): PlainCustomAttributes => {
  const plain: PlainCustomAttributes = {};
  for (const [assetType, byId] of definition) {
    for (const [id, attribute] of byId) {
      plain[customAttributeKey(assetType, id)] = attribute;
    }
  }
  return plain;
};

export const customAttributesFromPlain = (
  plain: PlainCustomAttributes,
): CustomAttributesDefinition => {
  const definition: CustomAttributesDefinition = new Map();
  for (const [key, attribute] of Object.entries(plain)) {
    const { assetType, id } = splitCustomAttributeKey(key);
    let byId = definition.get(assetType);
    if (!byId) {
      byId = new Map<string, CustomAttribute>();
      definition.set(assetType, byId);
    }
    byId.set(id, attribute);
  }
  return definition;
};
