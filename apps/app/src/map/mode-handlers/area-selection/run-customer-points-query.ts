import { Position } from "src/types";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { toSearchPolygon } from "src/hydraulic-model/spatial-queries";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

/**
 * Synchronously find customer-point ids whose coordinates lie inside the
 * given polygon. Customer-point counts are typically modest; we skip the
 * worker pipeline used for assets.
 */
export const runCustomerPointsQuery = (
  hydraulicModel: HydraulicModel,
  points: Position[],
): number[] => {
  const searchPolygon = toSearchPolygon(points);
  const result: number[] = [];
  for (const customerPoint of hydraulicModel.customerPoints.values()) {
    const coord = customerPoint.coordinates;
    const lng = coord[0];
    const lat = coord[1];
    if (
      lng < searchPolygon.bounds[0] ||
      lng > searchPolygon.bounds[2] ||
      lat < searchPolygon.bounds[1] ||
      lat > searchPolygon.bounds[3]
    ) {
      continue;
    }
    if (
      searchPolygon.isBounds ||
      booleanPointInPolygon(coord, searchPolygon.polygon)
    ) {
      result.push(customerPoint.id);
    }
  }
  return result;
};
