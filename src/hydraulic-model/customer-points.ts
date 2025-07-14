export interface CustomerPoint {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  properties: {
    name?: string;
    description?: string;
    demand?: number;
    [key: string]: any; // Allow arbitrary GeoJSON properties
  };
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
