import { Pipe, PipeStatus } from "./pipe";
import { Pump, PumpStatus } from "./pump";
import { Junction } from "./junction";
import { Reservoir } from "./reservoir";
import { Valve } from "./valve";

export type Asset = Pipe | Junction | Reservoir | Pump | Valve;
export type AssetStatus = PipeStatus | PumpStatus;
export type NodeAsset = Junction | Reservoir;
export type LinkAsset = Pipe | Pump | Valve;

export { Pipe, Junction, Reservoir, Pump, Valve };
export type { AssetId } from "./base-asset";
export { BaseAsset } from "./base-asset";
export type { PipeProperties } from "./pipe";
