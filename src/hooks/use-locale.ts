import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Locale } from "src/infra/i18n/locale";
import { useUserSettings } from "src/hooks/use-user-settings";
import {
  useFeatureFlag,
  useFeatureFlagsReady,
} from "src/hooks/use-feature-flags";
import "src/infra/i18n/i18next-config";

export const useLocale = () => {
  const { locale, setLocale: setUserLocale } = useUserSettings();
  const { i18n } = useTranslation();
  const [isI18nReady, setIsI18nReady] = useState(false);
  const isJapaneseOn = useFeatureFlag("FLAG_JAPANESE");
  const featureFlagsReady = useFeatureFlagsReady();

  const effectiveLocale =
    locale === "ja" && !isJapaneseOn && featureFlagsReady ? "en" : locale;

  useEffect(() => {
    setIsI18nReady(false);
    const syncLanguage = async () => {
      if (i18n.language !== effectiveLocale) {
        await i18n.changeLanguage(effectiveLocale);
      }
      setIsI18nReady(true);
    };
    void syncLanguage();
  }, [effectiveLocale, i18n]);

  const setLocale = useCallback(
    async (newLocale: Locale) => {
      await setUserLocale(newLocale);
      await i18n.changeLanguage(newLocale);
    },
    [setUserLocale, i18n],
  );

  return {
    locale: effectiveLocale,
    setLocale,
    isI18nReady,
  };
};
