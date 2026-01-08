import { atom } from "jotai";

export type MomentPointer = {
  pointer: number;
  version: number;
};

export const mapSyncMomentAtom = atom<MomentPointer>({
  pointer: -1,
  version: 0,
});
