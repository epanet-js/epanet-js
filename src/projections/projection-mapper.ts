import { Position } from "geojson";
import { Projection, ProjectionConfig } from "./projection";
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
        projection: "wgs84",
        toWgs84: identity,
        toSource: identity,
        backdropUnits: "DEGREES",
      };
    case "xy-grid":
      return {
        projection: "xy-grid",
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
  switch (projection) {
    case "wgs84":
      return { type: "wgs84" };
    case "xy-grid":
      return { type: "xy-grid", centroid: computeCentroid(allPoints()) };
    default: {
      const unsupported: never = projection;
      throw new Error(`Unsupported projection: ${String(unsupported)}`);
    }
  }
};

export const getBackdropUnits = (
  config: ProjectionConfig,
): "NONE" | "DEGREES" => (config.type === "xy-grid" ? "NONE" : "DEGREES");
