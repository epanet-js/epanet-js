import { Position } from "geojson";
import { Projection, WGS84 } from "./projection";
import { transformPoint, inverseTransformPoint } from "./xy-grid-transform";
import {
  createProjectionTransformer,
  createInverseProjectionTransformer,
} from "src/lib/geojson-utils/coordinate-transform";

export type ProjectionMapper = {
  projection: Projection;
  toWgs84: (sourcePoint: Position) => Position;
  toSource: (wgs84Point: Position) => Position;
  backdropUnits: "NONE" | "DEGREES";
};

const identity = (p: Position): Position => p;

export const createProjectionMapper = (
  projection: Projection,
): ProjectionMapper => {
  switch (projection.type) {
    case "wgs84":
      return {
        projection: WGS84,
        toWgs84: identity,
        toSource: identity,
        backdropUnits: "DEGREES",
      };
    case "xy-grid":
      return {
        projection,
        toWgs84: (p) =>
          transformPoint(p, projection.centroid, projection.scale),
        toSource: (p) =>
          inverseTransformPoint(p, projection.centroid, projection.scale),
        backdropUnits: "NONE",
      };
    case "proj4": {
      const forward = createProjectionTransformer(projection.code);
      const inverse = createInverseProjectionTransformer(projection.code);
      return {
        projection,
        toWgs84: (p) => forward(p as [number, number]),
        toSource: (p) => inverse(p as [number, number]),
        backdropUnits: "NONE",
      };
    }
  }
};

export const getBackdropUnits = (projection: Projection): "NONE" | "DEGREES" =>
  projection.type === "wgs84" ? "DEGREES" : "NONE";
