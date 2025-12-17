import { atom } from "jotai";

export type MapSnapshotPointer = {
  pointer: number;
  version: number;
};

export const mapSnapshotPointerAtom = atom<MapSnapshotPointer>({
  pointer: -1,
  version: 0,
});
