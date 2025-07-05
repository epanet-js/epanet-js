import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Locale } from "src/infra/i18n/locale";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserSettings } from "src/hooks/use-user-settings";
import "src/infra/i18n/i18next-config";

export const useLocale = () => {
  const { locale, setLocale: setUserLocale } = useUserSettings();
  const isI18NextOn = useFeatureFlag("FLAG_I18NEXT");
  const { i18n } = useTranslation();
  const [isI18nReady, setIsI18nReady] = useState(false);

  useEffect(() => {
    if (isI18NextOn) {
      setIsI18nReady(false);
      const syncLanguage = async () => {
        if (i18n.language !== locale) {
          await i18n.changeLanguage(locale);
        }
        setIsI18nReady(true);
      };
      void syncLanguage();
    } else {
      setIsI18nReady(true);
    }
  }, [isI18NextOn, locale, i18n]);

  const setLocale = useCallback(
    async (newLocale: Locale) => {
      await setUserLocale(newLocale);
      if (isI18NextOn) {
        await i18n.changeLanguage(newLocale);
      }
    },
    [setUserLocale, isI18NextOn, i18n],
  );

  return {
    locale,
    setLocale,
    isI18nReady,
  };
};
