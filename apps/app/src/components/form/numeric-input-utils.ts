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

export const isNumber = (value: number) => !Number.isNaN(value);

export const validationStateFor = (
  value: string,
  {
    isRequired,
    commitInvalidValues,
    validate = isNumber,
  }: {
    isRequired: boolean;
    commitInvalidValues: boolean;
    validate?: (value: number) => boolean;
  },
) => {
  const isEmpty = value.trim() === "";
  const numericValue = parseLocaleNumber(value);
  const isNonNumeric = !isEmpty && isNaN(numericValue);
  const hasError = isEmpty ? isRequired : !validate(numericValue);
  const isBlocked = isNonNumeric || (hasError && !commitInvalidValues);
  return { hasError, isBlocked };
};
