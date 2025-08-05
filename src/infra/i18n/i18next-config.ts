import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

import enTranslations from "../../../public/locales/en/translation.json";

const createConfig = () => ({
  resources: {
    en: {
      translation: enTranslations,
    },
  },
  fallbackLng: "en",
  lng: "en",
  debug: process.env.NODE_ENV === "development",

  react: {
    useSuspense: false,
  },

  interpolation: {
    escapeValue: false,
  },

  backend: {
    loadPath: (lng: string, _namespace: string) => {
      const isLocalesOn = getEnabledFlagsFromUrl().includes("FLAG_LOCALES");
      if (isLocalesOn && lng !== "en" && lng !== "es") {
        return `https://epanet-js.github.io/epanet-js-locales/locales/${lng}/translation.json`;
      }
      return `/locales/${lng}/translation.json`;
    },
    allowMultiLoading: false,
    requestOptions: {
      cache: "default",
    },
  },
  partialBundledLanguages: true,
  load: "currentOnly" as const,
});

const getEnabledFlagsFromUrl = (): string[] => {
  if (typeof window === "undefined" || typeof window.location === "undefined") {
    return [];
  }

  const urlParams = new URLSearchParams(window.location.search);
  const enabledFlags: string[] = [];

  for (const [key, value] of urlParams.entries()) {
    if (key.startsWith("FLAG_")) {
      if (value.toLowerCase() === "true") {
        enabledFlags.push(key);
      }
    }
  }

  return enabledFlags;
};

void i18n.use(Backend).use(initReactI18next).init(createConfig());

export default i18n;
