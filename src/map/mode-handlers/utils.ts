import { Data, Sel } from "src/state/jotai";
import { newFeatureId } from "src/lib/id";
import { MomentInput } from "src/lib/persistence/moment";
import { GeoJsonProperties, Geometry } from "src/types";
import { ModeWithOptions } from "src/state";
import { USelection } from "src/selection";
import { e6position } from "src/lib/geometry";

type PutFeature = MomentInput["putFeatures"][0];

export function getMapCoord(
  e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
) {
  return e6position(e.lngLat.toArray(), 7) as Pos2;
}

export function createOrUpdateFeature({
  mode,
  featureMapDeprecated,
  geometry,
  selection,
  properties = {},
}: {
  selection: Sel;
  mode: ModeWithOptions;
  featureMapDeprecated: Data["featureMapDeprecated"];
  geometry: Geometry;
  properties?: GeoJsonProperties;
}): PutFeature {
  const id = newFeatureId();
  const replaceGeometryForId = mode.modeOptions?.replaceGeometryForId;
  const wrappedFeature =
    replaceGeometryForId && featureMapDeprecated.get(replaceGeometryForId);

  if (wrappedFeature) {
    const p: PutFeature = {
      ...wrappedFeature,
      feature: {
        ...wrappedFeature.feature,
        geometry,
      },
    };

    return p;
  }

  return {
    id,
    folderId: USelection.folderId(selection),
    feature: {
      type: "Feature",
      properties,
      geometry,
    },
  };
}
