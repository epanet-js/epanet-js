import { useAtomCallback } from "jotai/utils";
import {
  simulationPlaybackAtom,
  stopPlaybackAtom,
  changePlaybackSpeedAtom,
} from "src/state/simulation-playback";
import { useUserTracking } from "src/infra/user-tracking";
import { ChangeTimestepSource } from "./change-timestep";

export const togglePlaybackShortcut = "shift+space";

type ChangePlaybackSource = ChangeTimestepSource | "auto";

export const useTogglePlayback = () => {
  const userTracking = useUserTracking();

  const togglePlayback = useAtomCallback<void, [ChangePlaybackSource]>(
    (get, set, source) => {
      const { isPlaying } = get(simulationPlaybackAtom);
      const next = !isPlaying;
      set(simulationPlaybackAtom, (prev) => ({ ...prev, isPlaying: next }));
      userTracking.capture({
        name: "simulation.playback.toggled",
        action: next ? "play" : "pause",
        source,
      });
    },
  );

  const stopPlayback = useAtomCallback<void, [ChangePlaybackSource]>(
    (get, set, source) => {
      if (!get(simulationPlaybackAtom).isPlaying) return;
      set(stopPlaybackAtom);
      userTracking.capture({
        name: "simulation.playback.toggled",
        action: "pause",
        source,
      });
    },
  );

  const changePlaybackSpeed = useAtomCallback<void, [number]>(
    (_get, set, speedMs) => {
      set(changePlaybackSpeedAtom, speedMs);
      userTracking.capture({
        name: "simulation.playback.speedChanged",
        speedMs,
      });
    },
  );

  return {
    togglePlayback,
    stopPlayback,
    changePlaybackSpeed,
  };
};
