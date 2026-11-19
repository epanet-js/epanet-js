export type TimeSequenceError = "outOfOrder" | "repeated";

export const validateTimeSequence = (
  times: readonly number[],
): TimeSequenceError[] => {
  const errors: TimeSequenceError[] = [];
  const isOutOfOrder = times.some(
    (time, i) => time < 0 || (i > 0 && time < times[i - 1]),
  );
  const isRepeated = times.some((time, i) => i > 0 && time === times[i - 1]);
  if (isOutOfOrder) errors.push("outOfOrder");
  if (isRepeated) errors.push("repeated");
  return errors;
};

export const isTimeInSequenceAt = (
  times: readonly number[],
  index: number,
  time: number,
): boolean => {
  const previous = index > 0 ? times[index - 1] : -Infinity;
  const next = index < times.length - 1 ? times[index + 1] : Infinity;
  return time >= 0 && time > previous && time < next;
};
