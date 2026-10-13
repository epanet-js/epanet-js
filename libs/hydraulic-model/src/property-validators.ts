// Year is intentionally stricter than the permissive DB schema, so it keeps its
// own range here. Material has no constraints, so it needs no validator.
export const isValidInstallationYear = (year: number) =>
  Number.isInteger(year) && year >= 1000 && year <= 9999;
