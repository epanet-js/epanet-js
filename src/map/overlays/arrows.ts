import { GeoJsonLayer, IconLayer } from "@deck.gl/layers";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetId, AssetsMap, LinkAsset } from "src/hydraulic-model";
import { IFeature } from "src/types";
import { slots } from "../slots";
import { getIconsSprite } from "../icons";
import { LinkSegment, LinkSegmentsMap } from "../link-segments";

export const buildArrowsOverlay = ({
  name,
  assets,
  segments,
  rangeColorMapping,
  isVisible,
  getValue,
}: {
  name: string;
  assets: AssetsMap;
  segments: LinkSegmentsMap;
  rangeColorMapping: RangeColorMapping;
  isVisible: (link: AssetId) => boolean;
  getValue: (link: LinkAsset) => number | null;
}) => {
  const iconsSprite = getIconsSprite();
  const linkWithData = [];
  const arrows = [];
  const colorForLink = new Map();
  for (const asset of assets.values()) {
    if (
      !asset.isLink ||
      getValue(asset as LinkAsset) === null ||
      !isVisible(asset.id)
    )
      continue;

    linkWithData.push(asset);
    const value = getValue(asset as LinkAsset) as number;
    const absValue = Math.abs(value);
    colorForLink.set(asset.id, rangeColorMapping.colorFor(absValue));

    const linkSegments = segments.get(asset.id);
    if (!linkSegments) continue;

    arrows.push(
      ...linkSegments.map((segment: LinkSegment) => ({
        position: segment.midpoint,
        angle: value > 0 ? segment.angle : segment.angle180,
        color: colorForLink.get(asset.id),
        size: chooseSizeFor(segment.lengthInMeters),
      })),
    );
  }

  return [
    new GeoJsonLayer({
      id: `analysis-${name}`,
      beforeId: slots["after-lines-slot"],
      data: linkWithData as unknown as IFeature[],
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 5,
      getLineColor: (pipe) => colorForLink.get(pipe.id),
      lineCapRounded: true,
    }),
    new IconLayer({
      id: `analysis-${name}-icons`,
      data: arrows,
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
