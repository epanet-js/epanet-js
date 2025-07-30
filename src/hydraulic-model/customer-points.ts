import { Position } from "geojson";
import { Junction } from "./asset-types/junction";

export type AllocationRule = {
  maxDistance: number;
  maxDiameter: number;
};

export const defaultAllocationRules: AllocationRule[] = [
  { maxDistance: 100, maxDiameter: 300 },
  //{ maxDistance: 50, maxDiameter: 300 },
  //{ maxDistance: 150, maxDiameter: 200 },
  //{ maxDistance: 100, maxDiameter: 300 },
];

export interface CustomerPointConnection {
  pipeId: string;
  snapPoint: Position;
  distance: number;
  junction?: Junction;
}

export class CustomerPoint {
  public readonly id: string;
  public readonly coordinates: Position;
  private properties: { baseDemand: number };
  private connectionData: CustomerPointConnection | null = null;

  constructor(
    id: string,
    coordinates: Position,
    properties: { baseDemand: number },
  ) {
    this.id = id;
    this.coordinates = coordinates;
    this.properties = properties;
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

  copy(): CustomerPoint {
    return new CustomerPoint(this.id, [...this.coordinates], {
      baseDemand: this.baseDemand,
    });
  }
}

export const validateCustomerPoint = (data: any): data is CustomerPoint => {
  return (
    typeof data === "object" &&
    typeof data.id === "string" &&
    Array.isArray(data.coordinates) &&
    data.coordinates.length === 2 &&
    typeof data.coordinates[0] === "number" &&
    typeof data.coordinates[1] === "number" &&
    typeof data.properties === "object"
  );
};

export type CustomerPoints = Map<string, CustomerPoint>;

export const initializeCustomerPoints = (): CustomerPoints => {
  return new Map<string, CustomerPoint>();
};
