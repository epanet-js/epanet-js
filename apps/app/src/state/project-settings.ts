import { atom } from "jotai";
import {
  type ProjectSettings,
  defaultProjectSettings,
} from "src/lib/project-settings";
import { type CustomAttributesDefinition } from "src/lib/custom-attributes";

export type ProjectSettingsWithCustomAttributes = ProjectSettings & {
  customAttributes?: CustomAttributesDefinition;
};

export const projectSettingsAtom = atom<ProjectSettingsWithCustomAttributes>(
  defaultProjectSettings,
);
