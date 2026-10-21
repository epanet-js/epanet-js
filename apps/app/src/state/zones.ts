import { atom } from "jotai";
import type { Zones } from "@epanet-js/hydraulic-model";
import { stagingModelDerivedAtom } from "./derived-branch-state";

export const zonesDeprecatedAtom = atom<Zones>(new Map());

export const isZonesInModelOnAtom = atom(false);

export const zonesAtom = atom<Zones>((get) =>
  get(isZonesInModelOnAtom)
    ? get(stagingModelDerivedAtom).zones
    : get(zonesDeprecatedAtom),
);
