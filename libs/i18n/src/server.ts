import i18next from "i18next";
import Backend from "i18next-http-backend";

const localesUrl = "https://epanet-js.github.io/epanet-js-locales/locales";

export const cdnLoadPath =
  (namespace: string) =>
  (lngs: string[]): string =>
    `${localesUrl}/${lngs[0]}/${namespace}.json`;

export type ServerTranslateFn = (key: string) => string;

export type CreateServerI18nOptions = {
  enTranslations: Record<string, unknown>;
  loadPath: (lngs: string[], namespaces: string[]) => string;
  debug?: boolean;
};

export const createServerI18n = ({
  enTranslations,
  loadPath,
  debug,
}: CreateServerI18nOptions) => {
  const instance = i18next.createInstance();

  const ready = instance.use(Backend).init({
    resources: {
      en: {
        translation: enTranslations,
      },
    },
    fallbackLng: "en",
    lng: "en",
    debug: debug ?? false,

    interpolation: {
      escapeValue: false,
    },

    backend: {
      loadPath,
      allowMultiLoading: false,
      requestOptions: {
        cache: "default",
      },
    },
    partialBundledLanguages: true,
    load: "currentOnly",
  });

  return async (locale: string): Promise<ServerTranslateFn> => {
    await ready;

    if (locale !== "en") {
      try {
        await instance.loadLanguages(locale);
      } catch {}
    }

    return instance.getFixedT(locale);
  };
};
