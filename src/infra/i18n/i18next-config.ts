import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

import enTranslations from "./locales/en.json";

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
    lng: "en",
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
