import { GeoJsonLayer, IconLayer } from "@deck.gl/layers";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetId, AssetsMap, Pipe } from "src/hydraulic-model";
import { IFeature, Position } from "src/types";
import { slots } from "../slots";
import turfMidpont from "@turf/midpoint";
import { bearing } from "@turf/bearing";
import { getIconsSprite } from "../icons";

export const buildFlowsOverlay = (
  assets: AssetsMap,
  rangeColorMapping: RangeColorMapping,
  conditionFn: (assetId: AssetId) => boolean,
) => {
  const iconsSprite = getIconsSprite();
  const data: Pipe[] = [];
  const arrows = [];
  for (const asset of assets.values()) {
    if (
      asset.type !== "pipe" ||
      !conditionFn(asset.id) ||
      (asset as Pipe).flow === null
    )
      continue;

    arrows.push(...calculateArrows(asset as Pipe));
    data.push(asset as Pipe);
  }

  return [
    new GeoJsonLayer({
      id: "analysis-flows",
      beforeId: slots["after-lines-slot"],
      data: data as unknown as IFeature[],
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 5,
      getFillColor: [0, 0, 0],
      getLineColor: (pipe) =>
        rangeColorMapping.colorFor(
          Math.abs((pipe as unknown as Pipe).flow as number),
        ),
      getPointRadius: 4,
      lineCapRounded: true,
      antialiasing: true,
    }),
    new IconLayer({
      id: "analysis-flows-icons",
      data: arrows,
      getSize: 20,
      sizeUnits: "meters",
      sizeMinPixels: 4,
      sizeMaxPixels: 20,

      // @ts-expect-error type should be allowed https://deck.gl/docs/api-reference/layers/icon-layer#iconatlas
      iconAtlas: iconsSprite.atlas,
      iconMapping: iconsSprite.mapping,
      getIcon: (_d) => "arrow-white",
      getAngle: (d) => d.angle,
      getPosition: (d) => d.coordinates,
    }),
  ];
};

const calculateArrows = (
  pipe: Pipe,
): { angle: number; coordinates: Position }[] => {
  const coordinates = pipe.coordinates;
  const midpoints = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    const angleFromNorth = bearing(start, end);
    const angleFromEast = (90 - angleFromNorth + 360) % 360;

    midpoints.push({
      coordinates: turfMidpont(start, end).geometry.coordinates,
      angle: angleFromEast,
    });
  }
  return midpoints;
};
