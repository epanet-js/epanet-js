import { useAtom } from "jotai";
import { useCallback } from "react";
import { localeAtom } from "src/state/locale";
import { Locale } from "src/infra/i18n/locale";
import { useAuth } from "src/auth";
import {
  userSettingsAtom,
  type PrivacyPreferences,
} from "src/state/user-settings";

export type UserSettings = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  privacySettings: PrivacyPreferences | undefined;
  setPrivacySettings: (settings: PrivacyPreferences) => Promise<void>;
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

  const privacySettings: PrivacyPreferences = {
    analytics: true,
    errorReporting: true,
  };

  const setPrivacySettings = useCallback((settings: PrivacyPreferences) => {
    // eslint-disable-next-line no-console
    console.log("DEBUG: Privacy settings update for signed-in user", settings);
    return Promise.resolve();
  }, []);

  return {
    locale,
    setLocale,
    privacySettings,
    setPrivacySettings,
  };
};

const useUserSettingsWithoutAuth = (): UserSettings => {
  const [locale, setLocaleAtom] = useAtom(localeAtom);
  const [userSettings, setUserSettings] = useAtom(userSettingsAtom);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleAtom(newLocale);
      return Promise.resolve();
    },
    [setLocaleAtom],
  );

  const setPrivacySettings = useCallback(
    (settings: PrivacyPreferences) => {
      setUserSettings((prev) => ({
        ...prev,
        privacyPreferences: settings,
      }));
      return Promise.resolve();
    },
    [setUserSettings],
  );

  return {
    locale,
    setLocale,
    privacySettings: userSettings.privacyPreferences,
    setPrivacySettings,
  };
};

export const useUserSettings: UseUserSettingsHook = () => {
  const { isSignedIn } = useAuth();

  const authSettings = useUserSettingsWithAuth();
  const localSettings = useUserSettingsWithoutAuth();

  return isSignedIn ? authSettings : localSettings;
};
