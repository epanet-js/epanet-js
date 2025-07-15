export interface CustomerPointConnection {
  pipeId: string;
  snapPoint: [number, number];
  distance: number;
}

export interface CustomerPoint {
  id: string;
  coordinates: [number, number];
  properties: {
    name?: string;
    description?: string;
    demand?: number;
    [key: string]: any;
  };
  connection?: CustomerPointConnection;
}

export const createCustomerPoint = (
  coordinates: [number, number],
  properties: Record<string, any> = {},
  id?: string,
): CustomerPoint => ({
  id: id || "1",
  coordinates,
  properties,
});

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
