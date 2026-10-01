import { atom } from "jotai";
import type { Zones } from "@epanet-js/hydraulic-model";

export const zonesAtom = atom<Zones>(new Map());
