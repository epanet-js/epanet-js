import { AssetId, LinkAsset, LinkType, NodeAsset } from "src/hydraulic-model";
import { SnappingCandidate } from "./draw-link-state";

export interface EphemeralDrawLink {
  type: "drawLink";
  linkType: LinkType;
  link: LinkAsset;
  startNode?: NodeAsset;
  startPipeId?: AssetId;
  snappingCandidate: SnappingCandidate | null;
}
