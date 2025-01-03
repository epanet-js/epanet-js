import * as en from "./locales/en";
import * as es from "./locales/es";

export const locales = {
  en: en,
  es: es,
};
export type Locale = keyof typeof locales;

const codes = Object.keys(locales) as Locale[];

export const getLocale = (): Locale => {
  if (typeof window === "undefined") return "en";

  const language = navigator.language;
  const code = codes.find(
    (code) => language === code || language.startsWith(`${code}-`),
  );
  return code || "en";
};
