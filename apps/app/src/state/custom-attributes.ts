import { atom } from "jotai";
import {
  type CustomAttributesDefinition,
  CustomAttributes,
  emptyCustomAttributesDefinition,
} from "@epanet-js/custom-attributes";

export const customAttributesDefinitionAtom = atom<CustomAttributesDefinition>(
  emptyCustomAttributesDefinition(),
);

export const customAttributesAtom = atom(
  (get) => new CustomAttributes(get(customAttributesDefinitionAtom)),
);
