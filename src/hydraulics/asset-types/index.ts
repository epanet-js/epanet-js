import { Pipe } from "./pipe";
import { Junction } from "./junction";

export type Asset = Pipe | Junction;
export type NodeAsset = Junction;
export type LinkAsset = Pipe;

export { Pipe, Junction };
export type { AssetId } from "./base-asset";
