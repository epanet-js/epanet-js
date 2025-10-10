import { atomWithStorage } from "jotai/utils";

export type PrivacyPreferences = {
  analytics: boolean;
  errorReporting: boolean;
};

export type UserSettings = {
  showWelcomeOnStart: boolean;
  gdprConsentAnonymous: boolean;
  privacyPreferences: PrivacyPreferences;
};

export const defaultUserSettings: UserSettings = {
  showWelcomeOnStart: true,
  gdprConsentAnonymous: false,
  privacyPreferences: {
    analytics: true,
    errorReporting: true,
  },
};

export const userSettingsAtom = atomWithStorage<UserSettings>(
  "user-settings",
  defaultUserSettings,
);

export const settingsFromStorage = (): UserSettings => {
  const userSettings = {
    ...defaultUserSettings,
    ...(JSON.parse(
      localStorage.getItem("user-settings") || "{}",
    ) as Partial<UserSettings>),
  };

  return userSettings;
};
