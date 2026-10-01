import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { Locale, getLocale } from "@epanet-js/i18n/locale";

export const localeAtom = atomWithStorage<Locale>(
  "locale",
  getLocale(),
  createJSONStorage(() => sessionStorage),
);
