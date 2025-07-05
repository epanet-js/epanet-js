import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

import enTranslations from "./i18next-locales/en.json";
import { allSupportedLanguages } from "./locale";

const getInitialI18nLocale = (): string => {
  if (typeof window === "undefined") return "en";

  try {
    const savedValue = localStorage.getItem("locale");
    if (savedValue) {
      const savedLocale = JSON.parse(savedValue) as string;
      if (allSupportedLanguages.includes(savedLocale as any)) {
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

void i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
    },
    fallbackLng: "en",
    lng: getInitialI18nLocale(),
    debug: process.env.NODE_ENV === "development",

    react: {
      useSuspense: false,
    },

    interpolation: {
      escapeValue: false,
    },

    backend: {
      loadPath: "/locales/{{lng}}/translation.json",
      allowMultiLoading: false,
      requestOptions: {
        cache: "default",
      },
    },
    partialBundledLanguages: true,
    load: "currentOnly",
  });

export default i18n;
