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
