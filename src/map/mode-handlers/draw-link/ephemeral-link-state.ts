import { Position } from "geojson";
import { LinkAsset, LinkType, NodeAsset } from "src/hydraulic-model";

export interface EphemeralDrawLinkDeprecated {
  type: "drawLinkDeprecated";
  linkType: LinkType;
  link: LinkAsset;
  startNode?: NodeAsset;
  snappingCandidate: NodeAsset | null;
}

export interface EphemeralDrawLink {
  type: "drawLink";
  linkType: LinkType;
  link: LinkAsset;
  startNode?: NodeAsset;
  snappingCandidate: {
    type: NodeAsset["type"] | "pipe";
    position: Position;
  } | null;
}
