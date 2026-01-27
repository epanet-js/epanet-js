import { parseLocaleNumber } from "src/infra/i18n";

type NormalizeOptions = {
  positiveOnly?: boolean;
  allowExponentSign?: boolean;
};

export function normalizeNumericInput(
  input: string,
  options: NormalizeOptions = {},
): string {
  const { positiveOnly = false, allowExponentSign = false } = options;
  const pattern = allowExponentSign ? /[^0-9\-.,eE+]/g : /[^0-9\-.,eE]/g;
  let normalized = input.replace(pattern, "");
  if (positiveOnly) {
    normalized = normalized.replace(/^-/, "");
  }
  return normalized;
}

export function parseNumericInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const parsed = parseLocaleNumber(trimmed);
  return isNaN(parsed) ? null : parsed;
}

export function formatNumericDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat().format(value);
}
