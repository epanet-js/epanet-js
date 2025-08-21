import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { i18n } from "i18next";
import { Locale } from "src/infra/i18n/locale";
import { useUserSettings } from "src/hooks/use-user-settings";
import "src/infra/i18n/i18next-config";

const I18N_TIMEOUT_MS = 10000;

const changeLanguageWithTimeout = async (
  i18n: i18n,
  locale: Locale,
): Promise<void> => {
  const changeLanguagePromise = i18n.changeLanguage(locale).then(() => {});
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => resolve(), I18N_TIMEOUT_MS);
  });

  return Promise.race([changeLanguagePromise, timeoutPromise]).catch(() => {
    // Handle both network errors and timeouts gracefully
    // App continues with current/fallback translations
  });
};

export const useLocale = () => {
  const { locale, setLocale: setUserLocale } = useUserSettings();
  const { i18n } = useTranslation();
  const [isI18nReady, setIsI18nReady] = useState(false);

  const effectiveLocale = locale;

  useEffect(() => {
    setIsI18nReady(false);
    const syncLanguage = async () => {
      if (i18n.language !== effectiveLocale) {
        await changeLanguageWithTimeout(i18n, effectiveLocale);
      }
      setIsI18nReady(true);
    };
    void syncLanguage();
  }, [effectiveLocale, i18n]);

  const setLocale = useCallback(
    async (newLocale: Locale) => {
      setIsI18nReady(false);
      await setUserLocale(newLocale);
      await changeLanguageWithTimeout(i18n, newLocale);
      setIsI18nReady(true);
    },
    [setUserLocale, i18n],
  );

  return {
    locale: effectiveLocale,
    setLocale,
    isI18nReady,
  };
};
