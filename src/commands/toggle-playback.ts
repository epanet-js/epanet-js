import { useAtomCallback } from "jotai/utils";
import {
  simulationPlaybackAtom,
  stopPlaybackAtom,
  changePlaybackSpeedAtom,
  maximumPlaybackSpeedAtom,
  resolveSpeedByMode,
  type PlaybackSpeed,
  autoPlaybackSpeedAtom,
} from "src/state/simulation-playback";
import { useUserTracking } from "src/infra/user-tracking";
import { ChangeTimestepSource } from "./change-timestep";

export const togglePlaybackShortcut = "shift+space";

type ChangePlaybackSource = ChangeTimestepSource | "auto";

type StartPlaybackSource = "buttons" | "shortcut";

export const useTogglePlayback = () => {
  const userTracking = useUserTracking();

  const togglePlayback = useAtomCallback<void, ["shortcut" | "buttons"]>(
    (get, set, source) => {
      if (get(simulationPlaybackAtom).playingAtSpeedMs !== 0) {
        stopPlayback(source);
      } else {
        startPlayback(source);
      }
    },
  );

  const stopPlayback = useAtomCallback<void, [ChangePlaybackSource]>(
    (get, set, source) => {
      if (get(simulationPlaybackAtom).playingAtSpeedMs === 0) return;
      set(stopPlaybackAtom);
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
      const isTooFast = resolveSpeedByMode(autoMs, speed) < maxMs;
      set(changePlaybackSpeedAtom, speed);
      userTracking.capture({
        name: "simulation.playback.speedChanged",
        speed,
        isTooFast,
      });
    },
  );

  return {
    togglePlayback,
    stopPlayback,
    changePlaybackSpeed,
  };
};
