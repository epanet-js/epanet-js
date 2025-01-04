import { Locale, getLocale } from "./locale";

const symbols = {
  es: { decimals: ",", groups: "." },
  en: { decimals: ".", groups: "," },
};

export const parseLocaleNumber = (
  numberString: string,
  locale: Locale = getLocale(),
): number => {
  const localeSymbols = symbols[locale];

  try {
    const [wholePart, decimalsPart] = splitByDecimals(
      withoutSpaces(numberString),
      localeSymbols.decimals,
      localeSymbols.groups,
    );
    const wholePartWithoutGroups = removeGroupDelimiter(
      wholePart,
      localeSymbols.groups,
    );

    return parseFloat(wholePartWithoutGroups + "." + decimalsPart);
  } catch (error) {
    return NaN;
  }
};

export const reformatWithoutGroups = (
  formatedNumber: string,
  locale: Locale = getLocale(),
): string => {
  const localeSymbols = symbols[locale];
  return formatedNumber.replaceAll(localeSymbols.groups, "");
};

const withoutSpaces = (numberString: string): string => {
  return numberString.replaceAll(" ", "");
};

const splitByDecimals = (
  numberString: string,
  decimalSymbol: string,
  groupSymbol: string,
): [string, string] => {
  const result = numberString.split(decimalSymbol);
  if (result.length === 1) return [result[0], "0"];
  if (result.length > 2) throw new Error("Invalid decimals");

  const [wholePart, decimalsPart] = result;

  if (decimalsPart.includes(groupSymbol)) throw new Error("Invalid decimals");

  return [wholePart, decimalsPart];
};

const removeGroupDelimiter = (
  wholePart: string,
  groupSymbol: string,
): string => {
  const groups = wholePart.split(groupSymbol);
  if (groups.length === 1) return groups[0];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (i === groups.length - 1) {
      if (group.length !== 3) throw Error("Invalid group size");
      continue;
    }

    if (i > 0 && i < groups.length - 1) {
      if (group.length !== 3) throw Error("Invalid group size");
      continue;
    }
  }

  return wholePart.replaceAll(groupSymbol, "");
};
