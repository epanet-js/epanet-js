import { atom } from "jotai";
import { MomentLog } from "src/lib/persistence/moment-log";

export const momentLogAtom = atom<MomentLog>(new MomentLog());
