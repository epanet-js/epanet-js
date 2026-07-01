import { atom } from "jotai";
import {
  type CustomAttributesDefinition,
  type CustomAttributesData,
  type CustomAttributes,
  emptyCustomAttributesDefinition,
  emptyCustomAttributesData,
} from "@epanet-js/custom-attributes";

export const customAttributesDefinitionAtom = atom<CustomAttributesDefinition>(
  emptyCustomAttributesDefinition(),
);

export const customAttributesDataAtom = atom<CustomAttributesData>(
  emptyCustomAttributesData(),
);

export const customAttributesAtom = atom<CustomAttributes>((get) => ({
  definition: get(customAttributesDefinitionAtom),
  data: get(customAttributesDataAtom),
}));
