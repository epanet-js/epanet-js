import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { localeAtom } from "src/state/locale";
import { Locale } from "@epanet-js/i18n/locale";
import { useAuth } from "src/hooks/use-auth";

export type UserSettings = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
};

export type UseUserSettingsHook = () => UserSettings;

export const useUserSettings: UseUserSettingsHook = () => {
  const { user, isSignedIn } = useAuth();
  const [localLocale, setLocalLocale] = useAtom(localeAtom);
  const adoptedForUserId = useRef<string | null>(null);

  const accountLocale = isSignedIn ? user.getLocale?.() : undefined;
  const locale = accountLocale ?? localLocale;

  useEffect(() => {
    if (!isSignedIn) return;

    if (accountLocale) {
      if (accountLocale !== localLocale) setLocalLocale(accountLocale);
      return;
    }

    if (!user.setLocale || adoptedForUserId.current === user.id) return;
    adoptedForUserId.current = user.id;
    void user.setLocale(localLocale);
  }, [isSignedIn, accountLocale, localLocale, setLocalLocale, user]);

  const setLocale = useCallback(
    async (newLocale: Locale) => {
      if (isSignedIn && user.setLocale) {
        await user.setLocale(newLocale);
      } else {
        setLocalLocale(newLocale);
      }
    },
    [isSignedIn, user, setLocalLocale],
  );

  return {
    locale,
    setLocale,
  };
};
