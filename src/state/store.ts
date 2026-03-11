import { atom, createStore } from "jotai";

export type Store = ReturnType<typeof createStore>;

export const persistLayerConfigAtom = atom<boolean>(false);
