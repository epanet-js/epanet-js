export type EPSTiming = {
  duration: number;
  hydraulicTimestep: number;
  reportTimestep: number;
  patternTimestep: number;
};

export const nullEPSTiming = (): EPSTiming => ({
  duration: 0,
  hydraulicTimestep: 0,
  reportTimestep: 0,
  patternTimestep: 0,
});

export const isEPSEnabled = (timing: EPSTiming): boolean => {
  return timing.duration > 0;
};
