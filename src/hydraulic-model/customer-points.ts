import { Unit } from "src/quantity";
import { Position } from "geojson";
import { roundCoordinates } from "src/lib/geometry";
import { AssetId } from "./asset-types/base-asset";
import { CustomerPointsLookup } from "./customer-points-lookup";

export const MAX_CUSTOMER_POINT_LABEL_LENGTH = 50;

export type AllocationRule = {
  maxDistance: number;
  maxDiameter: number;
};

export const defaultAllocationRules: AllocationRule[] = [
  { maxDistance: 100, maxDiameter: 300 },
];

export const getDefaultAllocationRules = (units: {
  diameter: Unit;
  length: Unit;
}): AllocationRule[] => {
  const maxDiameter = units.diameter === "in" ? 12 : 300;
  const maxDistance = units.length === "ft" ? 320 : 100;

  return [{ maxDistance, maxDiameter }];
};

export interface CustomerPointConnection {
  pipeId: AssetId;
  snapPoint: Position;
  junctionId: AssetId;
}

export class CustomerPoint {
  public readonly id: number;
  public readonly label: string;
  public readonly coordinates: Position;
  private properties: { baseDemand: number };
  private connectionData: CustomerPointConnection | null = null;

  constructor(
    id: number,
    coordinates: Position,
    properties: { baseDemand: number; label: string },
  ) {
    this.id = id;
    this.label = properties.label;
    this.coordinates = coordinates;
    this.properties = { baseDemand: properties.baseDemand };
  }

  static build(
    id: number,
    coordinates: Position,
    properties: { baseDemand: number; label: string },
  ): CustomerPoint {
    return new CustomerPoint(id, roundCoordinates(coordinates), properties);
  }

  get baseDemand() {
    return this.properties.baseDemand;
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

  copyDisconnected(): CustomerPoint {
    return new CustomerPoint(this.id, [...this.coordinates], {
      baseDemand: this.baseDemand,
      label: this.label,
    });
  }
}

export class CustomerPoints extends Map<number, CustomerPoint> {}

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
