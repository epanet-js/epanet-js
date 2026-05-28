import { atom } from "jotai";
import { type Zones, initializeZones } from "src/lib/zones";

export const zonesAtom = atom<Zones>(initializeZones());
