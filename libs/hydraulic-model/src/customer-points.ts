import { Unit } from "@epanet-js/quantity";
import { Position } from "geojson";
import { AssetId } from "./asset-types/base-asset";
import { CustomerPointsLookup } from "./customer-points-lookup";

export const MAX_CUSTOMER_POINT_LABEL_LENGTH = 50;

export type CustomerPointAllocationRule = {
  maxDistance: number;
  maxDiameter: number;
};

export type CustomerPointId = number;

export const defaultAllocationRules: CustomerPointAllocationRule[] = [
  { maxDistance: 100, maxDiameter: 300 },
];

export const getDefaultAllocationRules = (units: {
  diameter: Unit;
  length: Unit;
}): CustomerPointAllocationRule[] => {
  const maxDiameter = units.diameter === "in" ? 12 : 300;
  const maxDistance = units.length === "ft" ? 320 : 100;

  return [{ maxDistance, maxDiameter }];
};

export interface CustomerPointConnection {
  pipeId: AssetId;
  snapPoint: Position;
  junctionId: AssetId;
}

export type CustomerPointProperties = {
  label: string;
};

export class CustomerPoint {
  public readonly id: CustomerPointId;
  public readonly coordinates: Position;
  private readonly properties: CustomerPointProperties;
  private connectionData: CustomerPointConnection | null = null;

  constructor(
    id: CustomerPointId,
    coordinates: Position,
    properties: CustomerPointProperties,
  ) {
    this.id = id;
    this.coordinates = coordinates;
    this.properties = { ...properties };
  }

  get label() {
    return this.properties.label;
  }

  setProperty(name: string, value: unknown) {
    this.properties[name as keyof CustomerPointProperties] = value as never;
  }

  getProperty(name: string) {
    return this.properties[name as keyof CustomerPointProperties];
  }

  listProperties() {
    return Object.keys(this.properties);
  }

  hasProperty(name: string): boolean {
    return name in this.properties;
  }

  get snapPosition(): Position | null {
    return this.connectionData ? this.connectionData.snapPoint : null;
  }

  get connection(): CustomerPointConnection | null {
    return this.connectionData;
  }

  connect(connection: CustomerPointConnection): void {
    this.connectionData = connection;
  }

  copy(): CustomerPoint {
    const copied = new CustomerPoint(this.id, [...this.coordinates], {
      ...this.properties,
    });
    if (this.connectionData) {
      copied.connect(this.connectionData);
    }
    return copied;
  }

  copyDisconnected(): CustomerPoint {
    return new CustomerPoint(this.id, [...this.coordinates], {
      ...this.properties,
    });
  }
}

export class CustomerPoints extends Map<number, CustomerPoint> {}

export type CustomerPointAllocationResult = {
  allocatedCustomerPoints: CustomerPoints;
  disconnectedCustomerPoints: CustomerPoints;
  ruleMatches: number[];
  customerPointsMatchedToZone: number;
};

export const initializeCustomerPoints = (): CustomerPoints => {
  return new Map<number, CustomerPoint>();
};

export const getCustomerPoints = (
  customerPoints: CustomerPoints,
  ids: number[],
): CustomerPoint[] => {
  return ids
    .map((id) => customerPoints.get(id))
    .filter((cp): cp is CustomerPoint => cp !== undefined);
};

export const getActiveCustomerPoints = (
  lookup: CustomerPointsLookup,
  assets: Map<AssetId, { isActive: boolean }>,
  assetId: AssetId,
): CustomerPoint[] => {
  const customerPoints = lookup.getCustomerPoints(assetId);
  return Array.from(customerPoints).filter((cp) => {
    if (!cp.connection) return false;
    const pipe = assets.get(cp.connection.pipeId);
    return pipe?.isActive ?? true;
  });
};
