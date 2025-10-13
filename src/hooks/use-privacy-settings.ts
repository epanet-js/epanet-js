import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

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

  const setPrivacySettings = (preferences: PrivacyPreferences) => {
    setPrivacySettingsAtom(preferences);
    return Promise.resolve();
  };

  return {
    privacySettings,
    setPrivacySettings,
  };
};

export const readRawPrivacySettings = (): PrivacyPreferences => {
  return JSON.parse(localStorage.getItem(storageKey) || "{}");
};
