import { Pipe } from "./pipe";
import { Junction } from "./junction";

export type AssetType = Pipe | Junction;
export type NodeType = Junction;
export type LinkType = Pipe;

export type { AssetType as Asset };
export type { LinkAsset } from "./link";
export type { NodeAsset } from "./node";
export { Pipe, Junction };
export type { AssetId } from "./asset";
