import i18n, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

export type CreateI18nOptions = {
  enTranslations: Record<string, unknown>;
  loadPath: (lngs: string[], namespaces: string[]) => string;
  debug?: boolean;
};

export const createI18n = (opts: CreateI18nOptions): I18nInstance => {
  void i18n
    .use(Backend)
    .use(initReactI18next)
    .init({
      resources: {
        en: {
          translation: opts.enTranslations,
        },
      },
      fallbackLng: "en",
      lng: "en",
      debug: opts.debug ?? false,

      react: {
        useSuspense: false,
      },

      interpolation: {
        escapeValue: false,
      },

      backend: {
        loadPath: opts.loadPath,
        allowMultiLoading: false,
        requestOptions: {
          cache: "default",
        },
      },
      partialBundledLanguages: true,
      load: "currentOnly",
    });

  return i18n;
};
