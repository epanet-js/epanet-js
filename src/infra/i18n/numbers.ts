import { isFeatureOn } from "../feature-flags";
import { Locale, getLocale, symbols } from "./locale";

const maxDecimals = 6;
const scientificThresholds = {
  min: 1e-3,
  max: 1e6,
};

export const localizeDecimal = (
  num: number,
  {
    locale = getLocale(),
    decimals = maxDecimals,
    scientific = true,
  }: { locale?: Locale; decimals?: number; scientific?: boolean } = {},
): string => {
  const options: Intl.NumberFormatOptions = {};
  options["maximumFractionDigits"] = maxDecimals;
  options["minimumFractionDigits"] = 0;

  let formattedNum: string;
  const absValue = Math.abs(num);
  if (
    isFeatureOn("FLAG_STATS") &&
    scientific &&
    (absValue < scientificThresholds.min || absValue > scientificThresholds.max)
  ) {
    formattedNum = num
      .toExponential(3)
      .toLocaleString()
      .replace(".", symbols[locale].decimals);
  } else {
    const roundedNum = roundToDecimal(num, decimals);
    const value = handleNegativeZero(roundedNum, decimals);
    formattedNum = value.toLocaleString(locale, options);
  }

  const isAllZero = formattedNum.match(/\d/g)?.every((digit) => digit === "0");
  return isAllZero ? "0" : formattedNum;
};

const roundToDecimal = (num: number, decimalPlaces?: number): number => {
  const decimals = decimalPlaces || determineDecimalPlaces(num);
  return applyRounding(num, decimals);
};

const applyRounding = (value: number, decimals = 0): number => {
  const scale = Math.pow(10, decimals);
  const smallDiff = 1e-12;
  return Number(Math.round(value * scale + smallDiff) / scale);
};

const determineDecimalPlaces = (value: number): number => {
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 100) return 0;
  if (absoluteValue >= 10) return 1;
  if (absoluteValue >= 1) return 2;
  return 3;
};

const handleNegativeZero = (num: number, fractionDigits: number): number => {
  return Math.ceil(num * Math.pow(10, fractionDigits)) === 0
    ? Math.abs(num)
    : num;
};
