import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useTranslation as useI18NextTranslation } from "react-i18next";
import type { i18n } from "i18next";
import { Locale } from "src/infra/i18n/locale";
import { useUserSettings } from "src/hooks/use-user-settings";
import "src/infra/i18n/i18next-config";
import { captureError } from "src/infra/error-tracking";
import { notify } from "src/components/notifications";
import { CrossCircledIcon } from "@radix-ui/react-icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { CircleX } from "lucide-react";

const I18N_TIMEOUT_MS = 10000;

const changeLanguageWithTimeout = async (
  i18n: i18n,
  locale: Locale,
  isLucideIconsOn: boolean,
): Promise<void> => {
  const changeLanguagePromise = i18n.changeLanguage(locale).then(() => {});
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => resolve(), I18N_TIMEOUT_MS);
  });

  return Promise.race([changeLanguagePromise, timeoutPromise]).catch(
    (error) => {
      captureError(error);
      notify({
        variant: "error",
        title: "Error",
        Icon: isLucideIconsOn ? CircleX : CrossCircledIcon,
      });
    },
  );
};

type LocaleContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  isI18nReady: boolean;
};

const LocaleContext = createContext<LocaleContextType | null>(null);

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  const { locale, setLocale: setUserLocale } = useUserSettings();
  const { i18n } = useI18NextTranslation();
  const [isI18nReady, setIsI18nReady] = useState(false);
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

  useEffect(() => {
    setIsI18nReady(false);
    const syncLanguage = async () => {
      if (i18n.language !== locale) {
        await changeLanguageWithTimeout(i18n, locale, isLucideIconsOn);
      }
      setIsI18nReady(true);
    };
    void syncLanguage();
  }, [locale, i18n, isLucideIconsOn]);

  const setLocale = useCallback(
    async (newLocale: Locale) => {
      await setUserLocale(newLocale);
    },
    [setUserLocale],
  );

  const value: LocaleContextType = {
    locale,
    setLocale,
    isI18nReady,
  };

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
};
