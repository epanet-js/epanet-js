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

type Notation = { shape: RegExp; decimal: string; group: string };

// A grouped whole part never starts with a zero, which is what tells "0.001"
// apart from a grouping that happens to fit.
const DOT_DECIMAL: Notation = {
  shape: /^[+-]?(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)?(?:\.\d+)?(?:[eE][+-]?\d+)?$/,
  decimal: ".",
  group: ",",
};

const COMMA_DECIMAL: Notation = {
  shape: /^[+-]?(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)?(?:,\d+)?(?:[eE][+-]?\d+)?$/,
  decimal: ",",
  group: ".",
};

export const parseDecimal = (
  value: string,
  {
    locale = getLocale(),
    decimal,
  }: { locale?: Locale; decimal?: "." | "," } = {},
): number | null => {
  const text = value.trim();
  if (text === "") return null;
  if (!text.includes(",") && !text.includes(".")) return finite(Number(text));

  const stated = decimal ?? symbols[locale].decimals;
  const [preferred, other] =
    stated === ","
      ? [COMMA_DECIMAL, DOT_DECIMAL]
      : [DOT_DECIMAL, COMMA_DECIMAL];

  return readAs(text, preferred) ?? readAs(text, other);
};

const readAs = (
  text: string,
  { shape, decimal, group }: Notation,
): number | null =>
  shape.test(text)
    ? finite(Number(text.split(group).join("").replace(decimal, ".")))
    : null;

const finite = (number: number): number | null =>
  Number.isFinite(number) ? number : null;
