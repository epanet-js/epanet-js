import { PipeQuantity } from "./pipe";
import { JunctionQuantity } from "./junction";
import { ReservoirQuantity } from "./reservoir";
import { PumpQuantity } from "./pump";
import { ValveQuantity } from "./valve";
import { TankQuantity } from "./tank";

export type DefaultsSpec = {
  pipe: Partial<Record<PipeQuantity, number>>;
  junction: Partial<Record<JunctionQuantity, number>>;
  reservoir: Partial<Record<ReservoirQuantity | "relativeHead", number>>;
  pump: Partial<Record<PumpQuantity, number>>;
  valve: Partial<Record<ValveQuantity, number>>;
  tank: Partial<Record<TankQuantity, number>>;
};
