export function roundToSignificantDigits(num: number, digits = 3) {
  if (num === 0) {
    return 0;
  }
  const scale = Math.pow(
    10,
    digits - Math.floor(Math.log10(Math.abs(num))) - 1,
  );
  return Math.round(num * scale) / scale;
}
