import { atom } from "jotai";
import {
  type ProjectSettings,
  defaultProjectSettings,
} from "@epanet-js/project-settings";

export const projectSettingsAtom = atom<ProjectSettings>(
  defaultProjectSettings,
);
