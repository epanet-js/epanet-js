import { GeoJsonLayer, IconLayer } from "@deck.gl/layers";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetId, AssetsMap, Pipe } from "src/hydraulic-model";
import { IFeature, Position } from "src/types";
import { slots } from "../slots";
import turfMidpont from "@turf/midpoint";
import { bearing } from "@turf/bearing";
import turfLength from "@turf/length";
import { getIconsSprite } from "../icons";
import { Sprite } from "../icons/icons-sprite";

type Arrow = {
  coordinates: Position;
  angle: number;
  value: number;
};

type Arrows = Record<string, Arrow[]>;

export const buildFlowsOverlay = (
  assets: AssetsMap,
  rangeColorMapping: RangeColorMapping,
  conditionFn: (assetId: AssetId) => boolean,
) => {
  const iconsSprite = getIconsSprite();
  const data: Pipe[] = [];

  const arrows = {
    50: [],
    20: [],
    10: [],
    5: [],
    2: [],
    1: [],
  };
  for (const asset of assets.values()) {
    if (
      asset.type !== "pipe" ||
      !conditionFn(asset.id) ||
      (asset as Pipe).flow === null
    )
      continue;

    appendArrows(arrows, asset as Pipe);
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
    buildArrowIconLayer({
      size: 50,
      data: arrows[50],
      rangeColorMapping,
      iconsSprite,
    }),
    buildArrowIconLayer({
      size: 20,
      data: arrows[20],
      rangeColorMapping,
      iconsSprite,
    }),
    buildArrowIconLayer({
      size: 10,
      data: arrows[10],
      rangeColorMapping,
      iconsSprite,
    }),
    buildArrowIconLayer({
      size: 5,
      data: arrows[5],
      rangeColorMapping,
      iconsSprite,
    }),
    buildArrowIconLayer({
      size: 2,
      data: arrows[2],
      rangeColorMapping,
      iconsSprite,
    }),
    buildArrowIconLayer({
      size: 1,
      data: arrows[1],
      rangeColorMapping,
      iconsSprite,
    }),
  ];
};

const buildArrowIconLayer = ({
  data,
  size,
  iconsSprite,
  rangeColorMapping,
}: {
  data: Arrow[];
  size: number;
  iconsSprite: Sprite;
  rangeColorMapping: RangeColorMapping;
}): IconLayer => {
  return new IconLayer({
    id: `analysis-flows-icons-${size}`,
    data,
    getSize: size,
    sizeUnits: "meters",
    sizeMinPixels: 0,
    sizeMaxPixels: 24,
    // @ts-expect-error type should be allowed https://deck.gl/docs/api-reference/layers/icon-layer#iconatlas
    iconAtlas: iconsSprite.atlas,
    iconMapping: iconsSprite.mapping,
    getIcon: (_d) => "arrow",
    getAngle: (d) => d.angle as number,
    getPosition: (d) => d.coordinates as [number, number],
    getColor: (d) => rangeColorMapping.colorFor(Math.abs(d.value)),
  });
};

const appendArrows = (arrows: Arrows, pipe: Pipe): void => {
  const coordinates = pipe.coordinates;
  const flow = pipe.flow as number;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    const segmentLengthInMeters =
      turfLength({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [start, end],
        },
      } as IFeature) * 1000;

    const arrowsForSize = chooseSize(arrows, segmentLengthInMeters);
    arrowsForSize.push(buildArrow([start, end], flow));
  }
};

const chooseSize = (arrows: Arrows, segmentLengthInMeters: number): Arrow[] => {
  if (100 <= segmentLengthInMeters) return arrows[50];
  if (50 <= segmentLengthInMeters) return arrows[20];
  if (20 <= segmentLengthInMeters) return arrows[10];
  if (10 <= segmentLengthInMeters) return arrows[5];
  if (5 <= segmentLengthInMeters) return arrows[2];

  return arrows[1];
};

const buildArrow = (coordinates: Position[], flow: number): Arrow => {
  const [start, end] = coordinates;
  const angleFromNorth = flow > 0 ? bearing(start, end) : bearing(end, start);
  const angleFromEast = (90 - angleFromNorth + 360) % 360;

  return {
    coordinates: turfMidpont(start, end).geometry.coordinates,
    angle: angleFromEast,
    value: flow,
  };
};
