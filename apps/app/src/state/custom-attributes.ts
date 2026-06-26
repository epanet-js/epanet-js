import { atom } from "jotai";
import {
  type CustomAttributesDefinition,
  emptyCustomAttributesDefinition,
} from "@epanet-js/custom-attributes";

export const customAttributesDefinitionAtom = atom<CustomAttributesDefinition>(
  emptyCustomAttributesDefinition(),
);
