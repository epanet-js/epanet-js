import { atom } from "jotai";
import {
  estimatedResultsFetchDurationAtom,
  estimatedSourceRebuildDurationAtom,
} from "src/state/performance";

export type PlaybackSpeed = "auto" | "x2" | "x4";

export type SimulationPlaybackState = {
  playingAtSpeedMs: number; // 0 = not playing
  playbackSpeed: PlaybackSpeed;
};

export const simulationPlaybackAtom = atom<SimulationPlaybackState>({
  playingAtSpeedMs: 0,
  playbackSpeed: "auto",
});

export const stopPlaybackAtom = atom(null, (_get, set) => {
  set(simulationPlaybackAtom, (prev) => ({ ...prev, playingAtSpeedMs: 0 }));
});

export const maximumPlaybackSpeedAtom = atom<number>((get) => {
  const fetch = get(estimatedResultsFetchDurationAtom);
  const rebuild = get(estimatedSourceRebuildDurationAtom);
  if (fetch === null || rebuild === null) return 1000;
  return Math.ceil((1.2 * (fetch + rebuild)) / 50) * 50;
});

export const autoPlaybackSpeedAtom = atom<number>((get) => {
  const maxMs = get(maximumPlaybackSpeedAtom);
  return Math.ceil(maxMs / 1000) * 1000;
});

export function resolveSpeedByMode(
  playbackSpeedMs: number,
  mode: PlaybackSpeed,
): number {
  if (mode === "x2") return playbackSpeedMs / 2;
  if (mode === "x4") return playbackSpeedMs / 4;
  return playbackSpeedMs;
}

export const changePlaybackSpeedAtom = atom(
  null,
  (_get, set, speed: PlaybackSpeed) => {
    set(simulationPlaybackAtom, (prev) => ({
      ...prev,
      playbackSpeed: speed,
    }));
  },
);
