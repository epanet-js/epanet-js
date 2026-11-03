import { atom } from "jotai";
import type { Zones } from "@epanet-js/hydraulic-model";
import { stagingModelDerivedAtom } from "./derived-branch-state";

export const zonesAtom = atom<Zones>(
  (get) => get(stagingModelDerivedAtom).zones,
);
