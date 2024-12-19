import { GeoJsonLayer, IconLayer } from "@deck.gl/layers";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetId, AssetsMap, Pipe } from "src/hydraulic-model";
import { IFeature } from "src/types";
import { slots } from "../slots";
import { getIconsSprite } from "../icons";
import { Layer as DeckLayer } from "@deck.gl/core";
import { LinkSegment, LinkSegmentsMap } from "../link-segments";

export const buildFlowsOverlay = (
  assets: AssetsMap,
  segments: LinkSegmentsMap,
  rangeColorMapping: RangeColorMapping,
  visibilityFn: (assetId: AssetId) => boolean,
): DeckLayer[] => {
  const iconsSprite = getIconsSprite();
  const pipesWithFlow = [];
  const flowArrows = [];
  const colorForPipe = new Map();
  for (const asset of assets.values()) {
    if (
      asset.type !== "pipe" ||
      (asset as Pipe).flow === null ||
      !visibilityFn(asset.id)
    )
      continue;

    pipesWithFlow.push(asset);
    const flow = (asset as Pipe).flow as number;
    const absFlow = Math.abs(flow);
    colorForPipe.set(asset.id, rangeColorMapping.colorFor(absFlow));

    const pipeSegments = segments.get(asset.id);
    if (!pipeSegments) continue;

    flowArrows.push(
      ...pipeSegments.map((segment: LinkSegment) => ({
        position: segment.midpoint,
        angle: flow > 0 ? segment.angle : segment.angle180,
        color: colorForPipe.get(asset.id),
        size: chooseSizeFor(segment.lengthInMeters),
      })),
    );
  }

  return [
    new GeoJsonLayer({
      id: "analysis-flows",
      beforeId: slots["after-lines-slot"],
      data: pipesWithFlow as unknown as IFeature[],
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 5,
      getLineColor: (pipe) => colorForPipe.get(pipe.id),
      lineCapRounded: true,
    }),
    new IconLayer({
      id: "analysis-flows-icons",
      data: flowArrows,
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
