import { atomWithStorage } from "jotai/utils";

export type UserSettings = {
  showFirstScenarioDialog: boolean;
};

export const defaultUserSettings: UserSettings = {
  showFirstScenarioDialog: true,
};

export const userSettingsAtom = atomWithStorage<UserSettings>(
  "user-settings",
  defaultUserSettings,
);

export const hideHintsAtom = atomWithStorage<string[]>("hideHints", []);

export const settingsFromStorage = (): UserSettings => {
  const userSettings = {
    ...defaultUserSettings,
    ...(JSON.parse(
      localStorage.getItem("user-settings") || "{}",
    ) as Partial<UserSettings>),
  };

  return userSettings;
};
