import { atom } from "jotai";

export type SimulationPlaybackState = {
  isPlaying: boolean;
  playbackSpeedMs: number;
};

export const simulationPlaybackAtom = atom<SimulationPlaybackState>({
  isPlaying: false,
  playbackSpeedMs: 1000,
});

export const stopPlaybackAtom = atom(null, (_get, set) => {
  set(simulationPlaybackAtom, (prev) => ({ ...prev, isPlaying: false }));
});

export const changePlaybackSpeedAtom = atom(
  null,
  (_get, set, speedMs: number) => {
    set(simulationPlaybackAtom, (prev) => ({
      ...prev,
      playbackSpeedMs: speedMs,
    }));
  },
);
