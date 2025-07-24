import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Locale } from "src/infra/i18n/locale";
import { useUserSettings } from "src/hooks/use-user-settings";
import "src/infra/i18n/i18next-config";

export const useLocale = () => {
  const { locale, setLocale: setUserLocale } = useUserSettings();
  const { i18n } = useTranslation();
  const [isI18nReady, setIsI18nReady] = useState(locale === "en");

  useEffect(() => {
    if (locale === "en" && isI18nReady) {
      return;
    }

    setIsI18nReady(false);
    const syncLanguage = async () => {
      if (i18n.language !== locale) {
        await i18n.changeLanguage(locale);
      }
      setIsI18nReady(true);
    };
    void syncLanguage();
  }, [locale, i18n, isI18nReady]);

  const setLocale = useCallback(
    async (newLocale: Locale) => {
      await setUserLocale(newLocale);
      await i18n.changeLanguage(newLocale);
    },
    [setUserLocale, i18n],
  );

  return {
    locale,
    setLocale,
    isI18nReady,
  };
};
