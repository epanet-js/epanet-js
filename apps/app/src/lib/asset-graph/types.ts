import type {
  JunctionProperty,
  TankProperty,
  ReservoirProperty,
  PipeProperty,
  PumpProperty,
  ValveProperty,
} from "src/simulation/epanet/eps-results-reader";

export interface QuickGraphPropertyByAssetType {
  junction: JunctionProperty;
  tank: TankProperty;
  reservoir: ReservoirProperty;
  pipe: PipeProperty;
  pump: PumpProperty;
  valve: ValveProperty;
}

export type QuickGraphAssetType = keyof QuickGraphPropertyByAssetType;
