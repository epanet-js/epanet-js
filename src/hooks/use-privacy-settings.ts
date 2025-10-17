import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useMemo } from "react";

export type PrivacyPreferences = {
  skipAnalytics: boolean;
  skipErrorReporting: boolean;
};

const storageKey = "privacy-settings";

const privacySettingsAtom = atomWithStorage<PrivacyPreferences | undefined>(
  storageKey,
  undefined,
);

export const usePrivacySettings = () => {
  const [privacySettings, setPrivacySettingsAtom] =
    useAtom(privacySettingsAtom);

  const setPrivacySettings = useCallback(
    (preferences: PrivacyPreferences) => {
      setPrivacySettingsAtom(preferences);
      return Promise.resolve();
    },
    [setPrivacySettingsAtom],
  );

  const enableAllTracking = useCallback(() => {
    void setPrivacySettings({
      skipErrorReporting: false,
      skipAnalytics: false,
    });
  }, [setPrivacySettings]);

  return useMemo(
    () => ({
      privacySettings,
      setPrivacySettings,
      enableAllTracking,
    }),
    [privacySettings, setPrivacySettings, enableAllTracking],
  );
};

export const readRawPrivacySettings = (): PrivacyPreferences => {
  return JSON.parse(
    localStorage.getItem(storageKey) || "{}",
  ) as PrivacyPreferences;
};
