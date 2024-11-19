import { Pipe } from "./pipe";
import { Junction } from "./junction";

export type AssetType = Pipe | Junction;
export type NodeType = Junction;
export type LinkType = Pipe;

export { Pipe, Junction };
export type { AssetId } from "./asset";
