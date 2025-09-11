import { LinkAsset, LinkType, NodeAsset } from "src/hydraulic-model";
import { SnappingCandidate } from "./draw-link-state";

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
  snappingCandidate: SnappingCandidate | null;
}
