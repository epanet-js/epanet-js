import { createI18n } from "@epanet-js/i18n";

import enTranslations from "../../../public/locales/en/translation.json";

const i18n = createI18n({
  enTranslations,
  debug: process.env.NODE_ENV === "development",
  loadPath: (lngs: string[]) => {
    const lng = lngs[0];
    if (lng !== "en") {
      return `https://epanet-js.github.io/epanet-js-locales/locales/${lng}/translation.json`;
    }
    return `/locales/${lng}/translation.json`;
  },
});

export default i18n;
