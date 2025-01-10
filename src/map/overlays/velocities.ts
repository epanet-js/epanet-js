import { GeoJsonLayer, IconLayer } from "@deck.gl/layers";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetId, AssetsMap, Pipe } from "src/hydraulic-model";
import { IFeature } from "src/types";
import { slots } from "../slots";
import { getIconsSprite } from "../icons";
import { Layer as DeckLayer } from "@deck.gl/core";
import { LinkSegment, LinkSegmentsMap } from "../link-segments";

export const buildVelocitiesOverlay = (
  assets: AssetsMap,
  segments: LinkSegmentsMap,
  rangeColorMapping: RangeColorMapping,
  visibilityFn: (assetId: AssetId) => boolean,
): DeckLayer[] => {
  const iconsSprite = getIconsSprite();
  const pipesWithVelocity = [];
  const velocityArrows = [];
  const colorForPipe = new Map();
  for (const asset of assets.values()) {
    if (
      asset.type !== "pipe" ||
      (asset as Pipe).velocity === null ||
      !visibilityFn(asset.id)
    )
      continue;

    pipesWithVelocity.push(asset);
    const velocity = (asset as Pipe).velocity as number;
    const absVelocity = Math.abs(velocity);
    colorForPipe.set(asset.id, rangeColorMapping.colorFor(absVelocity));

    const pipeSegments = segments.get(asset.id);
    if (!pipeSegments) continue;

    velocityArrows.push(
      ...pipeSegments.map((segment: LinkSegment) => ({
        position: segment.midpoint,
        angle: velocity > 0 ? segment.angle : segment.angle180,
        color: colorForPipe.get(asset.id),
        size: chooseSizeFor(segment.lengthInMeters),
      })),
    );
  }

  return [
    new GeoJsonLayer({
      id: "analysis-velocities",
      beforeId: slots["after-lines-slot"],
      data: pipesWithVelocity as unknown as IFeature[],
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 5,
      getLineColor: (pipe) => colorForPipe.get(pipe.id),
      lineCapRounded: true,
    }),
    new IconLayer({
      id: "analysis-velocities-icons",
      data: velocityArrows,
      getSize: (d) => d.size,
      sizeUnits: "meters",
      sizeMinPixels: 0,
      sizeMaxPixels: 24,
      // @ts-expect-error type should be allowed https://deck.gl/docs/api-reference/layers/icon-layer#iconatlas
      iconAtlas: iconsSprite.atlas,
      iconMapping: iconsSprite.mapping,
      getIcon: (_d) => "arrow",
      getAngle: (d) => d.angle,
      getPosition: (d) => d.position,
      getColor: (d) => d.color,
    }),
  ];
};

const chooseSizeFor = (segmentLengthInMeters: number): number => {
  if (100 <= segmentLengthInMeters) return 50;
  if (50 <= segmentLengthInMeters) return 20;
  if (20 <= segmentLengthInMeters) return 10;
  if (10 <= segmentLengthInMeters) return 5;
  if (5 <= segmentLengthInMeters) return 2;

  return 1;
};
