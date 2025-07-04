import { atomWithStorage } from "jotai/utils";
import {
  Locale,
  allSupportedLanguages,
  stableLanguages,
} from "src/infra/i18n/locale";

const getInitialLocale = (): Locale => {
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

export const localeAtom = atomWithStorage<Locale>("locale", getInitialLocale());
