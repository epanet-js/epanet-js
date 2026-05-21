export const buildTimeLabels = (
  intervalsCount: number,
  intervalSeconds: number,
): string[] => {
  const labels: string[] = [];
  for (let i = 0; i < intervalsCount; i++) {
    const totalSeconds = i * intervalSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    labels.push(
      `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
    );
  }
  return labels;
};

export const calculateXAxisInterval = (
  intervalCount: number,
  intervalSeconds: number,
  targetTickCount = 8,
) => {
  const totalSeconds = intervalCount * intervalSeconds;
  const idealStep = totalSeconds / (targetTickCount - 1 || 1);
  const logicalSteps = [3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400];
  const bestStepSeconds = logicalSteps.reduce((prev, curr) =>
    Math.abs(curr - idealStep) < Math.abs(prev - idealStep) ? curr : prev,
  );
  const indexInterval = Math.max(
    1,
    Math.round(bestStepSeconds / intervalSeconds),
  );
  return (index: number) => index % indexInterval === 0;
};

export const calculateXAxisStep = (
  intervalCount: number,
  intervalSeconds: number,
  targetTickCount = 8,
): number => {
  const totalSeconds = intervalCount * intervalSeconds;
  const rawStep = totalSeconds / Math.max(targetTickCount - 1, 1);
  const step = [3600, 7200, 10800, 14400, 21600, 28800, 43200, 86400].reduce(
    (prev, curr) =>
      Math.abs(curr - rawStep) < Math.abs(prev - rawStep) ? curr : prev,
  );
  return Math.max(1, Math.round(step / intervalSeconds));
};

export const calculateInterval = (
  decimals: number,
  values: number[],
  targetIntervalsCount = 5,
): { min: number; max: number; interval: number } => {
  if (values.length === 0) return { min: 0, max: 0, interval: 0 };

  const factor = Math.pow(10, decimals);
  let rawMin = Infinity;
  let rawMax = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < rawMin) rawMin = v;
    if (v > rawMax) rawMax = v;
  }
  const minVal = Math.floor(rawMin * factor) / factor;
  const maxVal = Math.ceil(rawMax * factor) / factor;
  const range = maxVal - minVal;

  const minPrecision = Math.pow(10, -decimals + 1);
  let niceInterval = minPrecision;
  if (range > 0) {
    const roughInterval = range / (targetIntervalsCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
    const normalizedInterval = roughInterval / magnitude;
    const niceFactor = [1, 2, 2.5, 5, 10].reduce((prev, curr) =>
      Math.abs(curr - normalizedInterval) < Math.abs(prev - normalizedInterval)
        ? curr
        : prev,
    );
    niceInterval = Math.max(
      Math.round(niceFactor * magnitude * factor) / factor,
      minPrecision,
    );
  }
  if (niceInterval > minPrecision) {
    const min = Math.floor(minVal / niceInterval) * niceInterval;
    const max = Math.ceil(maxVal / niceInterval) * niceInterval;
    return { min, max, interval: niceInterval };
  }

  const offset =
    (targetIntervalsCount - 1) * minPrecision - Math.abs(maxVal - minVal);
  const halfOffset = offset / 2;

  let min: number;
  let max: number;
  if (minVal >= 0 && minVal < halfOffset) {
    const maxOffset = offset - minVal;
    min = 0;
    max = Math.floor((maxVal + maxOffset) / minPrecision) * minPrecision;
  } else {
    min = Math.ceil((minVal - halfOffset) / minPrecision) * minPrecision;
    max = Math.floor((maxVal + halfOffset) / minPrecision) * minPrecision;
  }

  while (min > minVal) min -= minPrecision;
  while (max < maxVal) max += minPrecision;

  return { min, max, interval: minPrecision };
};
