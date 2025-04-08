import { Pipe, PipeStatus } from "./pipe";
import { Pump } from "./pump";
import { Junction } from "./junction";

export type Asset = Pipe | Junction | Reservoir | Pump;
export type AssetStatus = PipeStatus;
export type NodeAsset = Junction | Reservoir;
export type LinkAsset = Pipe | Pump;

export { Pipe, Junction, Reservoir };
export type { AssetId } from "./base-asset";
export { BaseAsset } from "./base-asset";
export type { PipeProperties } from "./pipe";

import { Reservoir } from "./reservoir";
