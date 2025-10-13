import { useAtom } from "jotai";
import { useCallback } from "react";
import { localeAtom } from "src/state/locale";
import { Locale } from "src/infra/i18n/locale";
import { useAuth } from "src/auth";

export type UserSettings = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
};

export type UseUserSettingsHook = () => UserSettings;

const useUserSettingsWithAuth = (): UserSettings => {
  const { user, isSignedIn } = useAuth();

  const locale = (isSignedIn && user.getLocale?.()) || "en";

  const setLocale = useCallback(
    async (newLocale: Locale) => {
      if (isSignedIn && user.setLocale) {
        await user.setLocale(newLocale);
      }
    },
    [isSignedIn, user],
  );

  return {
    locale,
    setLocale,
  };
};

const useUserSettingsWithoutAuth = (): UserSettings => {
  const [locale, setLocaleAtom] = useAtom(localeAtom);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleAtom(newLocale);
      return Promise.resolve();
    },
    [setLocaleAtom],
  );

  return {
    locale,
    setLocale,
  };
};

export const useUserSettings: UseUserSettingsHook = () => {
  const { isSignedIn } = useAuth();

  const authSettings = useUserSettingsWithAuth();
  const localSettings = useUserSettingsWithoutAuth();

  return isSignedIn ? authSettings : localSettings;
};
