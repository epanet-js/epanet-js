export type NodeSizeConfig = {
  // Zoom at which junctions reach minSize; below it the radius clamps to minSize.
  minVisibleZoom: number;
  // Radius (px) at minVisibleZoom.
  minSize: number;
  // Radius (px) at the maximum map zoom.
  maxSize: number;
};

export const defaultNodeSizeConfig: NodeSizeConfig = {
  minVisibleZoom: 12,
  minSize: 1,
  maxSize: 12,
};
