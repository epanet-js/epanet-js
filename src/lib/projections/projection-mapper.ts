import { Position } from "geojson";
import { Projection, ProjectionConfig, WGS84, XY_GRID } from "./projection";
import {
  transformPoint,
  inverseTransformPoint,
  computeCentroid,
} from "./xy-grid-transform";

export type ProjectionMapper = {
  projection: Projection;
  toWgs84: (sourcePoint: Position) => Position;
  toSource: (wgs84Point: Position) => Position;
  backdropUnits: "NONE" | "DEGREES";
};

const identity = (p: Position): Position => p;

export const createProjectionMapper = (
  config: ProjectionConfig,
): ProjectionMapper => {
  switch (config.type) {
    case "wgs84":
      return {
        projection: WGS84,
        toWgs84: identity,
        toSource: identity,
        backdropUnits: "DEGREES",
      };
    case "xy-grid":
      return {
        projection: XY_GRID,
        toWgs84: (p) => transformPoint(p, config.centroid),
        toSource: (p) => inverseTransformPoint(p, config.centroid),
        backdropUnits: "NONE",
      };
  }
};

export const buildProjectionConfig = (
  projection: Projection,
  allPoints: () => Position[],
): ProjectionConfig => {
  switch (projection.id) {
    case "wgs84":
      return { type: "wgs84" };
    case "xy-grid":
      return { type: "xy-grid", centroid: computeCentroid(allPoints()) };
    default:
      throw new Error(`Unsupported projection: ${projection.id}`);
  }
};

export const getBackdropUnits = (
  config: ProjectionConfig,
): "NONE" | "DEGREES" => (config.type === "xy-grid" ? "NONE" : "DEGREES");
