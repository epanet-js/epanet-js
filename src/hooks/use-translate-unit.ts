import { useAtomValue } from "jotai";
import { localeAtom } from "src/state/locale";
import { UnitsLocale } from "src/infra/i18n/locales/locale";
import { locales } from "src/infra/i18n/locale";
import { captureError } from "src/infra/error-tracking";
import { Unit } from "src/quantity";

export const useTranslateUnit = () => {
  const locale = useAtomValue(localeAtom);

  return (unit: Unit): string => {
    const units = locales[locale].units;

    const text = units[unit as keyof UnitsLocale];
    if (!text) {
      captureError(new Error(`Missing unit locale for ${unit}`));
      return unit !== null ? (unit as string) : "";
    }

    return text;
  };
};
