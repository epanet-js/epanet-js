import { atom } from "jotai";

export type MapToolbarPosition = "top" | "bottom" | "left" | "right";

export const mapToolbarPositionAtom = atom<MapToolbarPosition>("top");
export const mapToolbarDockedAtom = atom<boolean>(true);
