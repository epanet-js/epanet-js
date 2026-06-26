import { atom } from "jotai";
import {
  type CustomAttributesDefinition,
  emptyCustomAttributesDefinition,
} from "src/lib/custom-attributes";

export const customAttributesAtom = atom<CustomAttributesDefinition>(
  emptyCustomAttributesDefinition(),
);
