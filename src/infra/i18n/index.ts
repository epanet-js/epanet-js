import { Translations, UnitsLocale } from "./locales/locale";
import * as en from "./locales/en";
import * as es from "./locales/es";
import { captureError } from "../error-tracking";

const locales = {
  en: en,
  es: es,
};
type Locale = keyof typeof locales;
const codes = Object.keys(locales) as Locale[];

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

export { localizeKeybinding } from "./mac";

const getLocale = (): Locale => {
  if (typeof window === "undefined") return "en";

  const language = navigator.language;
  const code = codes.find(
    (code) => language === code || language.startsWith(`${code}-`),
  );
  return code || "en";
};

export { localizeNumber, localizeDecimal } from "./numbers";
