import { Locale, getLocale } from "./locale";

const maxDecimals = 9;

export const localizeDecimal = (
  num: number,
  {
    locale = getLocale(),
    decimals = maxDecimals,
  }: { locale?: Locale; decimals?: number } = {},
): string => {
  const roundedNum = roundToDecimal(num, decimals);

  const options: Intl.NumberFormatOptions = {};
  options["maximumFractionDigits"] = maxDecimals;
  options["minimumFractionDigits"] = 0;
  const value = handleNegativeZero(roundedNum, decimals);

  const formattedNum = value.toLocaleString(locale, options);

  const isAllZero = formattedNum.match(/\d/g)?.every((digit) => digit === "0");
  return isAllZero ? "0" : formattedNum;
};

export const localizeDecimalDeprecated = (
  num: number,
  fractionDigits?: number,
): string => {
  if (fractionDigits === undefined) {
    fractionDigits = determineDecimalPlaces(num);
  }

  const roundedNum = roundToDecimal(num, fractionDigits);
  const formattedNum = localizeNumberDeprecated({
    number: roundedNum,
    fractionDigits,
  });
  const isAllZero = formattedNum.match(/\d/g)?.every((digit) => digit === "0");
  return isAllZero ? "0" : formattedNum;
};

const localizeNumberDeprecated = ({
  number,
  fractionDigits = 0,
}: {
  number: number;
  fractionDigits?: number;
}): string => {
  if (number === undefined) return "";
  const options: Intl.NumberFormatOptions = {};
  options["maximumFractionDigits"] = fractionDigits;
  options["minimumFractionDigits"] = fractionDigits;
  const value = handleNegativeZero(number, fractionDigits);

  const localizedNumber = value.toLocaleString(
    window.navigator.language,
    options,
  );

  return localizedNumber;
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
