const STEADY_STATE_STEP_SECONDS = 3600;

export const readingsStepSeconds = (timing: {
  duration: number;
  reportTimestep: number;
}): number =>
  timing.duration > 0 && timing.reportTimestep > 0
    ? timing.reportTimestep
    : STEADY_STATE_STEP_SECONDS;
