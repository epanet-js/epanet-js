import { atom } from "jotai";

export type ContentView = { type: "modelBuild"; step: string | null } | null;

export const contentViewAtom = atom<ContentView>(null);
