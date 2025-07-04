import * as en from "./locales/en";
import * as es from "./locales/es";
import * as ptBR from "./locales/pt-BR";

export const locales = {
  en: en,
  es: es,
  "pt-BR": ptBR,
};

export const symbols = {
  es: { decimals: ",", groups: "." },
  en: { decimals: ".", groups: "," },
  "pt-BR": { decimals: ",", groups: "." },
};

export type Locale = keyof typeof locales;

export const languageConfig: Array<{
  code: Locale;
  name: string;
  experimental?: boolean;
}> = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "pt-BR", name: "Português (BR)", experimental: true },
];

export const stableLanguages: Locale[] = languageConfig
  .filter((lang) => !lang.experimental)
  .map((lang) => lang.code);

export const allSupportedLanguages: Locale[] = languageConfig.map(
  (lang) => lang.code,
);

export const getLocaleDeprecated = (): Locale => {
  if (typeof window === "undefined") return "en";

  const language = navigator.language;
  const code = stableLanguages.find(
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
      if (allSupportedLanguages.includes(savedLocale)) {
        return savedLocale;
      }
    }
  } catch {}

  const language = navigator.language;
  const code = stableLanguages.find(
    (code) => language === code || language.startsWith(`${code}-`),
  );
  return code || "en";
};
