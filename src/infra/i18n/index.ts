import { Translations, UnitsLocale } from "./locales/locale";
import { captureError } from "../error-tracking";
import { getLocale, locales } from "./locale";

export const translate = (key: string): string => {
  const locale = getLocale();
  const translations = locales[locale].translations;

  const text = translations[key as keyof Translations];
  if (!text) {
    captureError(new Error(`Missing translation for ${key}`));
  }

  return text || key;
};

export const translateUnit = (key: string): string => {
  const locale = getLocale();
  const units = locales[locale].units;

  const text = units[key as keyof UnitsLocale];
  if (!text) {
    captureError(new Error(`Missing unit locale for ${key}`));
  }

  return text || key;
};

export { parseLocaleNumber, reformatWithoutGroups } from "./locale-number";
export { localizeKeybinding } from "./mac";

export { localizeNumber, localizeDecimal } from "./numbers";
