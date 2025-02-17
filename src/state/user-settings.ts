import { atomWithStorage } from "jotai/utils";

export type UserSettings = {
  showWelcomeOnStart: boolean;
};

export const defaultUserSettings = { showWelcomeOnStart: true };

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
