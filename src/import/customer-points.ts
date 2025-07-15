import { FeatureCollection } from "geojson";
import {
  createCustomerPoint,
  CustomerPoint,
} from "src/hydraulic-model/customer-points";

export const parseGeoJSONToCustomerPoints = (
  geoJson: FeatureCollection,
  startingId: number = 1,
): CustomerPoint[] => {
  if (!geoJson || geoJson.type !== "FeatureCollection") {
    throw new Error("Invalid GeoJSON: must be a FeatureCollection");
  }

  const customerPoints: CustomerPoint[] = [];
  let currentId = startingId;

  for (const feature of geoJson.features || []) {
    if (feature.geometry?.type !== "Point") {
      // eslint-disable-next-line no-console
      console.warn(
        "DEBUG: Skipping non-Point feature in customer points import",
      );
      continue;
    }

    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      // eslint-disable-next-line no-console
      console.warn("DEBUG: Skipping feature with invalid coordinates");
      continue;
    }

    try {
      const customerPoint = createCustomerPoint(
        [coordinates[0], coordinates[1]],
        feature.properties || {},
        currentId.toString(),
      );
      customerPoints.push(customerPoint);
      currentId++;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("DEBUG: Failed to create customer point:", error);
    }
  }

  return customerPoints;
};

export const parseGeoJSONLToCustomerPoints = (
  geoJsonLText: string,
  startingId: number = 1,
): CustomerPoint[] => {
  const lines = geoJsonLText.split("\n").filter((line) => line.trim());
  const customerPoints: CustomerPoint[] = [];
  let currentId = startingId;

  for (const line of lines) {
    try {
      const json = JSON.parse(line);

      // Skip metadata lines
      if (json.type === "metadata") {
        continue;
      }

      // Process feature lines
      if (json.type === "Feature" && json.geometry?.type === "Point") {
        const coordinates = json.geometry.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          // eslint-disable-next-line no-console
          console.warn("DEBUG: Skipping feature with invalid coordinates");
          continue;
        }

        const customerPoint = createCustomerPoint(
          [coordinates[0], coordinates[1]],
          json.properties || {},
          currentId.toString(),
        );
        customerPoints.push(customerPoint);
        currentId++;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("DEBUG: Failed to parse GeoJSONL line:", line, error);
    }
  }

  return customerPoints;
};

export const parseCustomerPointsFromFile = (
  fileContent: string,
  startingId: number = 1,
): CustomerPoint[] => {
  const trimmedContent = fileContent.trim();

  if (trimmedContent.startsWith("{")) {
    try {
      const geoJson = JSON.parse(fileContent);
      if (geoJson.type === "FeatureCollection") {
        return parseGeoJSONToCustomerPoints(geoJson, startingId);
      }
    } catch (error) {}
  }

  return parseGeoJSONLToCustomerPoints(fileContent, startingId);
};
