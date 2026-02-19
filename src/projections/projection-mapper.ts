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

export const buildProjectionMapper = (
  projection: Projection,
  allPoints: () => Position[],
): ProjectionMapper => {
  switch (projection) {
    case "wgs84":
      return createProjectionMapper({ type: "wgs84" });
    case "xy-grid": {
      const centroid = computeCentroid(allPoints());
      return createProjectionMapper({ type: "xy-grid", centroid });
    }
    default: {
      const unsupported: never = projection;
      throw new Error(`Unsupported projection: ${String(unsupported)}`);
    }
  }
};
