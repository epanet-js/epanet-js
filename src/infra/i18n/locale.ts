import * as en from "./locales-deprecated/en";
import * as es from "./locales-deprecated/es";
import * as ptBR from "./locales-deprecated/pt-BR";
import * as fr from "./locales-deprecated/fr";

export const locales = {
  en: en,
  es: es,
  "pt-BR": ptBR,
  fr: fr,
};

export const symbols = {
  es: { decimals: ",", groups: "." },
  en: { decimals: ".", groups: "," },
  "pt-BR": { decimals: ",", groups: "." },
  fr: { decimals: ",", groups: " " },
};

export type Locale = keyof typeof locales;

export const languageConfig: Array<{
  code: Locale;
  name: string;
  experimental?: boolean;
}> = [
  { code: "en", name: "English (US)" },
  { code: "es", name: "Español (ES)" },
  { code: "pt-BR", name: "Português (BR)", experimental: true },
  { code: "fr", name: "Français (FR)", experimental: true },
];

export const stableLanguages: Locale[] = languageConfig
  .filter((lang) => !lang.experimental)
  .map((lang) => lang.code);

export const allSupportedLanguages: Locale[] = languageConfig.map(
  (lang) => lang.code,
);

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
