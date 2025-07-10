import { LinkAsset, LinkType, NodeAsset } from "src/hydraulic-model";

export interface EphemeralDrawLink {
  type: "drawLink";
  linkType: LinkType;
  link: LinkAsset;
  startNode?: NodeAsset;
  snappingCandidate: NodeAsset | null;
}
