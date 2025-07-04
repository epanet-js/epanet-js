import * as en from "./locales/en";
import * as es from "./locales/es";

export const locales = {
  en: en,
  es: es,
};

export const symbols = {
  es: { decimals: ",", groups: "." },
  en: { decimals: ".", groups: "," },
};

export type Locale = keyof typeof locales;

const codes = Object.keys(locales) as Locale[];

export const getLocaleDeprecated = (): Locale => {
  if (typeof window === "undefined") return "en";

  const language = navigator.language;
  const code = codes.find(
    (code) => language === code || language.startsWith(`${code}-`),
  );
  return code || "en";
};

export const getLocale = (): Locale => {
  if (typeof window === "undefined") return "en";

  try {
    const savedValue = localStorage.getItem("locale");
    if (savedValue) {
      const savedLocale = JSON.parse(savedValue) as Locale;
      if (codes.includes(savedLocale)) {
        return savedLocale;
      }
    }
  } catch {}

  const language = navigator.language;
  const code = codes.find(
    (code) => language === code || language.startsWith(`${code}-`),
  );
  return code || "en";
};
