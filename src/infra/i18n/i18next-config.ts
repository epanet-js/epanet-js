import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslations from "./i18next-locales/en.json";
import esTranslations from "./i18next-locales/es.json";
import ptBRTranslations from "./i18next-locales/pt-BR.json";

const resources = {
  en: {
    translation: enTranslations,
  },
  es: {
    translation: esTranslations,
  },
  "pt-BR": {
    translation: ptBRTranslations,
  },
};

void i18n.use(initReactI18next).init({
  resources,
  fallbackLng: "en",
  lng: "en",
  debug: process.env.NODE_ENV === "development",

  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
