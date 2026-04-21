import { useAtomValue } from "jotai";
import type { Getter } from "jotai";
import { atomEffect } from "jotai-effect";
import { isDebugAppStateOn } from "src/infra/debug-mode";
import {
  simulationPlaybackAtom,
  stopPlaybackAtom,
} from "src/state/simulation-playback";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import {
  resultsFetchStartEffectAtom,
  resultsFetchTimingEffectAtom,
  sourceRebuildDurationsAtom,
  estimatedSourceRebuildDurationAtom,
  resultsFetchDurationsAtom,
  estimatedResultsFetchDurationAtom,
} from "src/state/performance";
import { setTimestepAtom } from "src/state/simulation-step";
import { simulationStepAtom } from "src/state/simulation";

export const SimulationPlaybackController = () => {
  useAtomValue(simulationPlaybackEffectAtom);
  useAtomValue(stopPlaybackOnSimulationRunAtom);
  useAtomValue(resultsFetchStartEffectAtom);
  useAtomValue(resultsFetchTimingEffectAtom);
  useAtomValue(performanceLoggingEffectAtom);
  return null;
};

const stopPlaybackOnSimulationRunAtom = atomEffect((get, set) => {
  const { status } = get(simulationDerivedAtom);
  if (status === "running" || status === "idle") {
    set(stopPlaybackAtom);
  }
});

const simulationPlaybackEffectAtom = atomEffect((get, set) => {
  const { playingAtSpeedMs } = get(simulationPlaybackAtom);
  if (playingAtSpeedMs === 0) return;

  const abortController = new AbortController();
  const { signal } = abortController;

  const getStep = () => get.peek(simulationStepAtom) ?? 0;
  const getSpeed = () => get.peek(simulationPlaybackAtom).playingAtSpeedMs;
  const getCount = () => getTimestepCount(get.peek);

  async function runLoop() {
    if (getStep() >= getCount() - 1) {
      set(setTimestepAtom, 0);
      if (signal.aborted) return;
    }

    while (!signal.aborted) {
      if (getStep() >= getCount() - 1) break;
      await sleep(getSpeed());
      if (signal.aborted) break;
      set(setTimestepAtom, getStep() + 1);
    }

    if (!signal.aborted && getStep() >= getCount() - 1) {
      set(stopPlaybackAtom);
    }
  }

  void runLoop();
  return () => abortController.abort();
});

function getTimestepCount(get: Getter): number {
  const simDerived = get(simulationDerivedAtom);
  return (
    ("epsResultsReader" in simDerived
      ? simDerived.epsResultsReader?.timestepCount
      : undefined) ?? 0
  );
}

const performanceLoggingEffectAtom = atomEffect((get) => {
  if (!isDebugAppStateOn) return;

  const rebuildDurations = get(sourceRebuildDurationsAtom);
  const fetchDurations = get(resultsFetchDurationsAtom);
  const estimatedRebuild = get.peek(estimatedSourceRebuildDurationAtom);
  const estimatedFetch = get.peek(estimatedResultsFetchDurationAtom);
  const lastRebuild = rebuildDurations.at(-1);
  const lastFetch = fetchDurations.at(-1);
  if (
    lastFetch !== undefined &&
    lastRebuild !== undefined &&
    fetchDurations.length === rebuildDurations.length
  ) {
    // eslint-disable-next-line no-console
    console.debug(
      [
        "[Playback timing limitations]",
        `  Fetch:   ${lastFetch?.toFixed(0) ?? "-"}ms (P90: ${estimatedFetch?.toFixed(0) ?? "-"}ms, n=${fetchDurations.length})`,
        `  Rebuild: ${lastRebuild?.toFixed(0) ?? "-"}ms (P90: ${estimatedRebuild?.toFixed(0) ?? "-"}ms, n=${rebuildDurations.length})`,
      ].join("\n"),
    );
  }
});

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
