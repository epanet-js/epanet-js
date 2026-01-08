import { atomWithStorage } from "jotai/utils";
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

export const quickGraphPinnedAtom = atomWithStorage<boolean>(
  "quickGraphPinned",
  false,
);

export const quickGraphPropertyAtom =
  atomWithStorage<QuickGraphPropertyByAssetType>("quickGraphProperty", {
    junction: "pressure",
    pipe: "flow",
    pump: "flow",
    valve: "flow",
    tank: "level",
    reservoir: "head",
  });

export const QUICK_GRAPH_PROPERTIES: {
  [K in QuickGraphAssetType]: {
    value: QuickGraphPropertyByAssetType[K];
    labelKey: string;
  }[];
} = {
  junction: [
    { value: "pressure", labelKey: "pressure" },
    { value: "head", labelKey: "head" },
    { value: "demand", labelKey: "actualDemand" },
  ],
  pipe: [
    { value: "flow", labelKey: "flow" },
    { value: "velocity", labelKey: "velocity" },
    { value: "headloss", labelKey: "unitHeadloss" },
  ],
  pump: [
    { value: "flow", labelKey: "flow" },
    { value: "headloss", labelKey: "pumpHead" },
  ],
  valve: [
    { value: "flow", labelKey: "flow" },
    { value: "velocity", labelKey: "velocity" },
    { value: "headloss", labelKey: "headlossShort" },
  ],
  tank: [
    { value: "level", labelKey: "level" },
    { value: "volume", labelKey: "volume" },
    { value: "pressure", labelKey: "pressure" },
    { value: "head", labelKey: "head" },
  ],
  reservoir: [{ value: "head", labelKey: "head" }],
};
