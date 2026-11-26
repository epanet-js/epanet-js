import type { ImportedSensor } from "./parse-sensor-data-file";

export type StepAlignment =
  | "matching"
  | "multiple"
  | "fraction"
  | "misaligned"
  | "sparse";

export const stepAlignmentOf = (
  { times }: Pick<ImportedSensor, "times">,
  reportTimestep: number,
): StepAlignment => {
  if (!times || reportTimestep <= 0) return "matching";
  const isOn = (step: number) => times.every((time) => time % step === 0);
  const interval = commonInterval(times);
  if (interval === null) return "sparse";

  if (isOn(reportTimestep)) {
    return interval === reportTimestep ? "matching" : "multiple";
  }
  if (reportTimestep % interval === 0 && isOn(interval)) return "fraction";
  return "misaligned";
};

const commonInterval = (times: number[]): number | null => {
  const counts = new Map<number, number>();
  for (let i = 1; i < times.length; i++) {
    const interval = times[i] - times[i - 1];
    counts.set(interval, (counts.get(interval) ?? 0) + 1);
  }
  let common: number | null = null;
  let most = 0;
  for (const [interval, count] of counts) {
    if (count > most) {
      common = interval;
      most = count;
    }
  }
  return common;
};
