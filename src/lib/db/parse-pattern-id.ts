export const parsePatternIdOrUndefined = (
  value: string | null,
): number | undefined => {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
