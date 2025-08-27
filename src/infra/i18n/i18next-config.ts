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
    loadPath: (lngs: string[], _namespaces: string[]) => {
      const lng = lngs[0];
      if (lng !== "en") {
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

void i18n.use(Backend).use(initReactI18next).init(createConfig());

export default i18n;
