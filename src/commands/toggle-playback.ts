import { useAtomCallback } from "jotai/utils";
import {
  simulationPlaybackAtom,
  stopPlaybackAtom,
  changePlaybackSpeedAtom,
  resolvePlaybackSpeedMs,
  isSpeedTooFast,
  type PlaybackSpeed,
} from "src/state/simulation-playback";
import { estimatedResultsUpdateDurationAtom } from "src/state/performance";
import { useUserTracking } from "src/infra/user-tracking";
import { ChangeTimestepSource } from "./change-timestep";

export const togglePlaybackShortcut = "shift+space";

type ChangePlaybackSource = ChangeTimestepSource | "auto";

export const useTogglePlayback = () => {
  const userTracking = useUserTracking();

  const togglePlayback = useAtomCallback<void, [ChangePlaybackSource]>(
    (get, set, source) => {
      const { playingAtSpeedMs, playbackSpeed } = get(simulationPlaybackAtom);
      const wasPlaying = playingAtSpeedMs !== 0;
      let resolvedMs: number | undefined;
      if (wasPlaying) {
        set(stopPlaybackAtom);
      } else {
        const estimated = get(estimatedResultsUpdateDurationAtom);
        resolvedMs = resolvePlaybackSpeedMs(playbackSpeed, estimated);
        set(simulationPlaybackAtom, (prev) => ({
          ...prev,
          playingAtSpeedMs: resolvedMs!,
        }));
      }
      userTracking.capture({
        name: "simulation.playback.toggled",
        action: wasPlaying ? "pause" : "play",
        source,
        speedMs: resolvedMs,
      });
    },
  );

  const stopPlayback = useAtomCallback<void, [ChangePlaybackSource]>(
    (get, set, source) => {
      if (get(simulationPlaybackAtom).playingAtSpeedMs === 0) return;
      set(stopPlaybackAtom);
      userTracking.capture({
        name: "simulation.playback.toggled",
        action: "pause",
        source,
      });
    },
  );

  const changePlaybackSpeed = useAtomCallback<void, [PlaybackSpeed]>(
    (get, set, speed) => {
      set(changePlaybackSpeedAtom, speed);
      const estimated = get(estimatedResultsUpdateDurationAtom);
      const warning =
        speed !== "auto" && estimated !== null
          ? isSpeedTooFast(speed, estimated)
          : false;
      userTracking.capture({
        name: "simulation.playback.speedChanged",
        speed,
        warning,
      });
    },
  );

  return {
    togglePlayback,
    stopPlayback,
    changePlaybackSpeed,
  };
};
