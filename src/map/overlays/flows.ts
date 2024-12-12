import { GeoJsonLayer, IconLayer } from "@deck.gl/layers";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetId, AssetsMap, Pipe } from "src/hydraulic-model";
import { IFeature, Position } from "src/types";
import { slots } from "../slots";
import turfMidpont from "@turf/midpoint";
import { bearing } from "@turf/bearing";
import turfLength from "@turf/length";
import { getIconsSprite } from "../icons";

type Arrow = {
  position: Position;
  angle: number;
  color: [number, number, number];
  size: number;
};

export const buildFlowsOverlay = (
  assets: AssetsMap,
  rangeColorMapping: RangeColorMapping,
  conditionFn: (assetId: AssetId) => boolean,
) => {
  const iconsSprite = getIconsSprite();
  const data: Pipe[] = [];
  const arrows: Arrow[] = [];

  for (const asset of assets.values()) {
    if (
      asset.type !== "pipe" ||
      !conditionFn(asset.id) ||
      (asset as Pipe).flow === null
    )
      continue;

    const pipe = asset as Pipe;
    appendArrows(arrows, pipe, rangeColorMapping);
    data.push(pipe);
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
      getSize: (d: Arrow) => d.size,
      sizeUnits: "meters",
      sizeMinPixels: 0,
      sizeMaxPixels: 24,
      // @ts-expect-error type should be allowed https://deck.gl/docs/api-reference/layers/icon-layer#iconatlas
      iconAtlas: iconsSprite.atlas,
      iconMapping: iconsSprite.mapping,
      getIcon: (_d) => "arrow",
      getAngle: (d: Arrow) => d.angle,
      getPosition: (d: Arrow) => d.position as [number, number],
      getColor: (d: Arrow) => d.color,
    }),
  ];
};

const appendArrows = (
  arrows: Arrow[],
  pipe: Pipe,
  rangeColorMapping: RangeColorMapping,
): void => {
  const flow = pipe.flow as number;

  for (const [start, end] of pipe.segments) {
    const length = measureSegment(start, end);
    const size = chooseSizeFor(length);
    arrows.push({
      position: turfMidpont(start, end).geometry.coordinates,
      angle: flow > 0 ? calculateAngle(start, end) : calculateAngle(end, start),
      color: rangeColorMapping.colorFor(Math.abs(flow)),
      size,
    });
  }
};

const measureSegment = (start: Position, end: Position) => {
  return (
    turfLength({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [start, end],
      },
    } as IFeature) * 1000
  );
};

const chooseSizeFor = (segmentLengthInMeters: number): number => {
  if (100 <= segmentLengthInMeters) return 50;
  if (50 <= segmentLengthInMeters) return 20;
  if (20 <= segmentLengthInMeters) return 10;
  if (10 <= segmentLengthInMeters) return 5;
  if (5 <= segmentLengthInMeters) return 2;

  return 1;
};

const calculateAngle = (start: Position, end: Position): number => {
  const angleFromNorth = bearing(start, end);
  const angleFromEast = (90 - angleFromNorth + 360) % 360;
  return angleFromEast;
};
