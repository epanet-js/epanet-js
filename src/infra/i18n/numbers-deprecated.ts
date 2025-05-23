import { Locale, getLocale, symbols } from "./locale";

const maxDecimals = 6;
const scientificThresholds = {
  min: 1e-3,
  max: 1e8,
};

export const localizeDecimalDeprecated = (
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
  if (
    (absValue > 0 && absValue < scientificThresholds.min) ||
    absValue > scientificThresholds.max
  ) {
    formattedNum = roundedValue
      .toExponential(3)
      .toLocaleString()
      .replace(".", symbols[locale].decimals);
  } else {
    formattedNum = roundedValue.toLocaleString(locale, options);
  }

  const isAllZero = formattedNum.match(/\d/g)?.every((digit) => digit === "0");
  return isAllZero ? "0" : formattedNum;
};

export const roundToDecimal = (num: number, decimalPlaces?: number): number => {
  return decimalPlaces === undefined ? num : applyRounding(num, decimalPlaces);
};

const applyRounding = (value: number, decimals = 0): number => {
  const scale = Math.pow(10, decimals);
  const smallDiff = 1e-12;
  return Number(Math.round(value * scale + smallDiff) / scale);
};
