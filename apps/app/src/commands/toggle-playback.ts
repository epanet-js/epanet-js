import { useAtomCallback } from "jotai/utils";
import {
  simulationPlaybackAtom,
  maximumPlaybackSpeedAtom,
  resolveSpeedByMode,
  type PlaybackSpeed,
  autoPlaybackSpeedAtom,
} from "src/state/simulation-playback";
import { useUserTracking } from "src/infra/user-tracking";

export const togglePlaybackShortcut = "shift+space";

type StartPlaybackSource = "buttons" | "shortcut";

export type StopPlaybackSource =
  | "shortcut"
  | "buttons"
  | "dropdown"
  | "quick-graph"
  | "auto";

export const useTogglePlayback = () => {
  const userTracking = useUserTracking();

  const togglePlayback = useAtomCallback<void, ["shortcut" | "buttons"]>(
    (get, _set, source) => {
      if (get(simulationPlaybackAtom).playingAtSpeedMs !== 0) {
        stopPlayback(source);
      } else {
        startPlayback(source);
      }
    },
  );

  const stopPlayback = useAtomCallback<void, [StopPlaybackSource]>(
    (get, set, source) => {
      if (get(simulationPlaybackAtom).playingAtSpeedMs === 0) return;
      set(simulationPlaybackAtom, (prev) => ({ ...prev, playingAtSpeedMs: 0 }));
      userTracking.capture({
        name: "simulation.playback.stopped",
        source,
      });
    },
  );

  const startPlayback = useAtomCallback<void, [StartPlaybackSource]>(
    (get, set, source) => {
      if (get(simulationPlaybackAtom).playingAtSpeedMs !== 0) return;
      const { playbackSpeed } = get(simulationPlaybackAtom);
      const autoPlaybackSpeed = get(autoPlaybackSpeedAtom);
      const maxMs = get(maximumPlaybackSpeedAtom);
      const resolvedSpeedMs = resolveSpeedByMode(
        autoPlaybackSpeed,
        playbackSpeed,
      );
      const isTooFast = resolvedSpeedMs < maxMs;
      set(simulationPlaybackAtom, (prev) => ({
        ...prev,
        playingAtSpeedMs: resolvedSpeedMs,
      }));
      userTracking.capture({
        name: "simulation.playback.started",
        source,
        speed: playbackSpeed,
        speedMs: resolvedSpeedMs,
        isTooFast,
      });
    },
  );

  const changePlaybackSpeed = useAtomCallback<void, [PlaybackSpeed]>(
    (get, set, speed) => {
      const autoMs = get(autoPlaybackSpeedAtom);
      const maxMs = get(maximumPlaybackSpeedAtom);
      const speedMs = resolveSpeedByMode(autoMs, speed);
      const isPlaying = get(simulationPlaybackAtom).playingAtSpeedMs !== 0;
      set(simulationPlaybackAtom, (prev) => ({
        ...prev,
        playbackSpeed: speed,
        ...(isPlaying && { playingAtSpeedMs: speedMs }),
      }));
      userTracking.capture({
        name: "simulation.playback.speedChanged",
        speed,
        speedMs,
        isTooFast: speedMs < maxMs,
      });
    },
  );

  return {
    togglePlayback,
    stopPlayback,
    changePlaybackSpeed,
  };
};
