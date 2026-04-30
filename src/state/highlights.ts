import { atom } from "jotai";

export type MarkerHighlight = {
  type: "marker";
  coordinates: [number, number];
};

export type Highlight = MarkerHighlight;

export const highlightsAtom = atom<Highlight[]>([]);
