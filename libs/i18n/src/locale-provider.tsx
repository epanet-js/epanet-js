import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { i18n as I18nInstance } from "i18next";
import { Locale } from "./locale";

const DEFAULT_TIMEOUT_MS = 10000;

export type LocaleContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  isI18nReady: boolean;
};

const LocaleContext = createContext<LocaleContextType | null>(null);

export type LocaleProviderProps = {
  children: React.ReactNode;
  i18n: I18nInstance;
  locale: Locale;
  setUserLocale: (locale: Locale) => Promise<void>;
  onError?: (error: unknown) => void;
  timeoutMs?: number;
};

export const LocaleProvider = ({
  children,
  i18n,
  locale,
  setUserLocale,
  onError,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: LocaleProviderProps) => {
  const [isI18nReady, setIsI18nReady] = useState(false);

  const changeLanguageWithTimeout = useCallback(
    async (i18n: I18nInstance, locale: Locale): Promise<void> => {
      const changeLanguagePromise = i18n.changeLanguage(locale).then(() => {});
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), timeoutMs);
      });

      return Promise.race([changeLanguagePromise, timeoutPromise]).catch(
        (error) => {
          onError?.(error);
        },
      );
    },
    [onError, timeoutMs],
  );

  useEffect(() => {
    setIsI18nReady(false);
    const syncLanguage = async () => {
      if (i18n.language !== locale) {
        await changeLanguageWithTimeout(i18n, locale);
      }
      setIsI18nReady(true);
    };
    void syncLanguage();
  }, [locale, i18n, changeLanguageWithTimeout]);

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
