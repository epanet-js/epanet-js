const STEADY_STATE_STEP_SECONDS = 3600;

export const reportStepSeconds = (timing: {
  duration: number;
  reportTimestep: number;
}): number =>
  timing.duration > 0 && timing.reportTimestep > 0
    ? timing.reportTimestep
    : STEADY_STATE_STEP_SECONDS;

export const seriesTimeRange = (
  series: readonly { times: readonly number[] }[],
): { start: number; end: number } => ({
  start: 0,
  end: Math.max(0, ...series.map(({ times }) => times[times.length - 1] ?? 0)),
});

export const stepTimes = (count: number, stepSeconds: number): number[] =>
  Array.from({ length: count }, (_, index) => index * stepSeconds);

export const timeStepAt = (
  seconds: number,
  stepSeconds: number,
  count: number,
): number | null => {
  if (stepSeconds <= 0) return null;
  const index = Math.round(seconds / stepSeconds);
  return index >= 0 && index < count ? index : null;
};
