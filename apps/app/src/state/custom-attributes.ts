import { atom } from "jotai";
import {
  type CustomAttributesDefinition,
  emptyCustomAttributesDefinition,
} from "@epanet-js/custom-attributes";

export const customAttributesAtom = atom<CustomAttributesDefinition>(
  emptyCustomAttributesDefinition(),
);
