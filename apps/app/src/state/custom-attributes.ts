import { atom } from "jotai";
import {
  type CustomAttributesDefinition,
  type CustomAttributesData,
  CustomAttributes,
  emptyCustomAttributesDefinition,
  emptyCustomAttributesData,
} from "@epanet-js/custom-attributes";

export const customAttributesDefinitionAtom = atom<CustomAttributesDefinition>(
  emptyCustomAttributesDefinition(),
);

export const customAttributesDataAtom = atom<CustomAttributesData>(
  emptyCustomAttributesData(),
);

export const customAttributesAtom = atom(
  (get) =>
    new CustomAttributes(
      get(customAttributesDefinitionAtom),
      get(customAttributesDataAtom),
    ),
);
