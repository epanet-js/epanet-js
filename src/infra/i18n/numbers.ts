import { Locale, getLocale, symbols } from "./locale";

const maxDecimals = 6;
const scientificThresholds = {
  min: 1e-3,
  max: 1e8,
};

const cachedFormatters: Record<string, Intl.NumberFormat> = {};

const getFormatter = (locale: string, decimals?: number): Intl.NumberFormat => {
  const key = `${locale}-${decimals ?? "default"}`;
  if (!cachedFormatters[key]) {
    cachedFormatters[key] = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals ?? maxDecimals,
    });
  }
  return cachedFormatters[key];
};

export const localizeDecimal = (
  num: number,
  {
    locale = getLocale(),
    decimals,
  }: { locale?: Locale; decimals?: number } = {},
): string => {
  const options: Intl.NumberFormatOptions = {};
  options["maximumFractionDigits"] = maxDecimals;
  options["minimumFractionDigits"] = 0;

  const roundedValue = roundToDecimal(num, decimals);

  let formattedNum: string;
  const absValue = Math.abs(roundedValue);
  if (absValue < 1e-12) return "0";

  if (
    (absValue > 0 && absValue < scientificThresholds.min) ||
    absValue > scientificThresholds.max
  ) {
    formattedNum = roundedValue
      .toExponential(3)
      .replace(".", symbols[locale].decimals);
  } else {
    formattedNum = getFormatter(locale, decimals).format(roundedValue);
  }

  return formattedNum;
};

export const roundToDecimal = (num: number, decimalPlaces?: number): number => {
  return decimalPlaces === undefined ? num : applyRounding(num, decimalPlaces);
};

const applyRounding = (value: number, decimals = 0): number => {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
};
