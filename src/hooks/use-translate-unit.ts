import { useAtomValue } from "jotai";
import { localeAtom } from "src/state/locale";
import { UnitsLocale } from "src/infra/i18n/locales/locale";
import { locales } from "src/infra/i18n/locale";
import { captureError } from "src/infra/error-tracking";

export const useTranslateUnit = () => {
  const locale = useAtomValue(localeAtom);

  return (key: string): string => {
    const units = locales[locale].units;

    const text = units[key as keyof UnitsLocale];
    if (!text) {
      captureError(new Error(`Missing unit locale for ${key}`));
    }

    return text || key;
  };
};
