import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type UserSettings = {
  showFirstScenarioDialog: boolean;
  showProjectSavedInfo: boolean;
  showFileFormatUpdated: boolean;
};

export const defaultUserSettings: UserSettings = {
  showFirstScenarioDialog: true,
  showProjectSavedInfo: true,
  showFileFormatUpdated: true,
};

const userSettingsStorageAtom = atomWithStorage<Partial<UserSettings>>(
  "user-settings",
  defaultUserSettings,
);

export const userSettingsAtom = atom(
  (get): UserSettings => ({
    ...defaultUserSettings,
    ...get(userSettingsStorageAtom),
  }),
  (get, set, update: UserSettings | ((prev: UserSettings) => UserSettings)) => {
    const prev: UserSettings = {
      ...defaultUserSettings,
      ...get(userSettingsStorageAtom),
    };
    const next = typeof update === "function" ? update(prev) : update;
    set(userSettingsStorageAtom, next);
  },
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
