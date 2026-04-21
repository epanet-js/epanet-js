import { atom } from "jotai";

export type PlaybackSpeed = "auto" | "x2" | "x4";

const PLAYBACK_SPEED_DIVISOR: Record<Exclude<PlaybackSpeed, "auto">, number> = {
  x2: 2,
  x4: 4,
};

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

export function resolveAutoSpeedMs(estimatedMs: number | null): number {
  if (estimatedMs === null) return 1000;
  return Math.max(1000, Math.ceil((1.2 * estimatedMs) / 1000) * 1000);
}

export function isSpeedTooFast(
  speed: Exclude<PlaybackSpeed, "auto">,
  estimatedMs: number,
): boolean {
  const divisor = speed === "x2" ? 2 : 4;
  return estimatedMs * 1.2 > resolveAutoSpeedMs(estimatedMs) / divisor;
}

export function resolvePlaybackSpeedMs(
  speed: PlaybackSpeed,
  estimatedMs: number | null,
): number {
  const autoMs = resolveAutoSpeedMs(estimatedMs);
  if (speed === "auto") return autoMs;
  return autoMs / PLAYBACK_SPEED_DIVISOR[speed];
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
