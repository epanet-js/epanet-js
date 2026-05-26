export function roundToSignificantDigits(num: number, digits = 3): number {
  if (!isFinite(num) || digits <= 0) return NaN;
  if (num === 0) return 0;

  const d = Math.ceil(Math.log10(Math.abs(num)));
  const power = digits - d;

  const magnitude = Math.pow(10, power);
  return Math.round(num * magnitude) / magnitude;
}
