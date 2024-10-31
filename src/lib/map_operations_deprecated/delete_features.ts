import type { Feature } from "src/types";
import { idToJSONPointers } from "src/lib/id";
import { removeDegenerates } from "src/lib/geometry";
import type { Operation } from "fast-json-patch";
import { applyPatch } from "fast-json-patch";
import * as jsonpointer from "src/lib/pointer";

export function removeCoordinatesVertex(
  id: VertexId,
  feature: Feature,
): Feature | null {
  const [pointer] = idToJSONPointers(id, feature);
  feature = jsonpointer.clone(feature, pointer);
  const patch: Operation = {
    op: "remove",
    path: pointer,
  };
  applyPatch(feature, [patch]);
  if (feature.geometry === null) return null;
  const geom = removeDegenerates(feature.geometry);
  return geom
    ? {
        ...feature,
        geometry: geom,
      }
    : null;
}
