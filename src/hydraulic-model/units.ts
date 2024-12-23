import { Unit } from "src/quantity";
import { JunctionQuantity } from "./asset-types/junction";
import { PipeQuantity } from "./asset-types/pipe";
import { ReservoirQuantity } from "./asset-types/reservoir";

export type ModelUnits = {
  pipe: Record<PipeQuantity, Unit>;
  junction: Record<JunctionQuantity, Unit>;
  reservoir: Record<ReservoirQuantity, Unit>;
};
