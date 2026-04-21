import { atom } from "jotai";
import { atomEffect } from "jotai-effect";
import { simulationStepAtom } from "src/state/simulation";
import {
  simulationResultsDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";

const MAX_MEASUREMENTS = 20;

function makeRollingDurationAtoms(percentile: number) {
  const durationsAtom = atom<number[]>([]);
  const estimatedAtom = atom<number | null>((get) => {
    const durations = get(durationsAtom);
    if (durations.length === 0) return null;
    const sorted = [...durations].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * percentile) - 1];
  });
  const appendAtom = atom(null, (_get, set, duration: number) => {
    if (duration <= 0) return;
    set(durationsAtom, (prev: number[]) => {
      const next = [...prev, duration];
      return next.length > MAX_MEASUREMENTS
        ? next.slice(-MAX_MEASUREMENTS)
        : next;
    });
  });
  return { durationsAtom, estimatedAtom, appendAtom };
}

// -- Source rebuild (map rendering) --
// Measures from inside the setTimeout update block to after updateIconsSource (map idle).
// P90: conservative estimate to account for occasional slow frames.

const sourceRebuild = makeRollingDurationAtoms(0.9);
export const sourceRebuildDurationsAtom = sourceRebuild.durationsAtom;
export const estimatedSourceRebuildDurationAtom = sourceRebuild.estimatedAtom;
export const appendSourceRebuildDurationAtom = sourceRebuild.appendAtom;

// -- Results fetch (file I/O) --
// Measures from when simulationStepAtom changes to when simulationResultsDerivedAtom
// settles with the new value. P90: file reads can spike, be more conservative.

const resultsFetch = makeRollingDurationAtoms(0.9);
export const resultsFetchDurationsAtom = resultsFetch.durationsAtom;
export const estimatedResultsFetchDurationAtom = resultsFetch.estimatedAtom;
const appendResultsFetchDurationAtom = resultsFetch.appendAtom;

const resultsFetchStartedAtAtom = atom<number | null>(null);

export const resultsFetchStartEffectAtom = atomEffect((get, set) => {
  get(simulationStepAtom);
  get(simulationDerivedAtom);
  set(resultsFetchStartedAtAtom, performance.now());
});

export const resultsFetchTimingEffectAtom = atomEffect((get, set) => {
  get(simulationResultsDerivedAtom);
  const startedAt = get.peek(resultsFetchStartedAtAtom);
  if (startedAt !== null) {
    set(appendResultsFetchDurationAtom, performance.now() - startedAt);
    set(resultsFetchStartedAtAtom, null);
  }
});
