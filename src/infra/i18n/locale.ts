export const symbols = {
  es: { decimals: ",", groups: "." },
  en: { decimals: ".", groups: "," },
  pt: { decimals: ",", groups: "." },
  fr: { decimals: ",", groups: "" },
  nl: { decimals: ",", groups: "." },
  ja: { decimals: ".", groups: "," },
};

export type Locale = "en" | "es" | "pt" | "fr" | "nl" | "ja";

export const languageConfig: Array<{
  code: Locale;
  name: string;
  experimental?: boolean;
}> = [
  { code: "en", name: "English (US)" },
  { code: "es", name: "Español (ES)" },
  { code: "pt", name: "Português (BR)", experimental: true },
  { code: "fr", name: "Français (FR)", experimental: true },
  { code: "nl", name: "Nederlands (NL)", experimental: true },
  { code: "ja", name: "日本語 (JP)", experimental: true },
];

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
  const code = allSupportedLanguages.find(
    (code) => language === code || language.startsWith(`${code}-`),
  );
  return code || "en";
};
