import { atom } from "jotai";
import {
  type ProjectSettings,
  defaultProjectSettings,
} from "src/lib/project-settings";

export const projectSettingsAtom = atom<ProjectSettings>(
  defaultProjectSettings,
);
