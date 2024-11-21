import { Pipe, PipeExplain } from "./pipe";
import { Junction, JunctionExplain } from "./junction";

export type Asset = Pipe | Junction;
export type AssetExplain = PipeExplain | JunctionExplain;
export type NodeAsset = Junction;
export type LinkAsset = Pipe;

export { Pipe, Junction };
export type { AssetId } from "./base-asset";
