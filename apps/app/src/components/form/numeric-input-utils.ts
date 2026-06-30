import { parseLocaleNumber } from "src/infra/i18n";

type NormalizeOptions = {
  allowExponentSign?: boolean;
};

export function normalizeNumericInput(
  input: string,
  options: NormalizeOptions = {},
): string {
  const { allowExponentSign = false } = options;
  const pattern = allowExponentSign ? /[^0-9\-.,eE+]/g : /[^0-9\-.,eE]/g;
  return input.replace(pattern, "");
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

export const isGreaterThanZero = (value: number) => value > 0;

export const isZeroOrGreater = (value: number) => value >= 0;

export const isWithinUnitRange = (value: number) => value >= 0 && value <= 1;
