import { useAtomValue } from "jotai";
import { localeAtom } from "src/state/locale";
import { UnitsLocale } from "src/infra/i18n/locales/locale";
import { locales } from "src/infra/i18n/locale";
import { captureError } from "src/infra/error-tracking";
import { Unit } from "src/quantity";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useCallback } from "react";
import { useLocale } from "src/hooks/use-locale";

// Units are standardized and the same across all languages
const UNITS_MAP: Record<Exclude<Unit, null>, string> = {
  m: "m",
  mm: "mm",
  in: "in",
  ft: "ft",
  "l/s": "l/s",
  "l/h": "l/h",
  km: "km",
  "gal/min": "gal/min",
  psi: "psi",
  mwc: "m",
  "m/s": "m/s",
  "ft/s": "ft/s",
  "ft^3/s": "ft³/s",
  "l/min": "l/min",
  "Mgal/d": "Mgal/d",
  "IMgal/d": "IMgal/d",
  "Ml/d": "Ml/d",
  "m^3/h": "m³/h",
  "m^3/d": "m³/d",
  "acft/d": "acft/d",
  hp: "hp",
  kW: "kW",
  "m/km": "m/km",
  "ft/kft": "ft/kft",
};

export const useTranslateUnit = () => {
  const locale = useAtomValue(localeAtom);
  const isI18NextOn = useFeatureFlag("FLAG_I18NEXT");
  const { isI18nReady } = useLocale();

  const translateUnit = useCallback(
    (unit: Unit): string => {
      if (!isI18nReady) {
        return unit !== null ? (unit as string) : "";
      }

      return unit ? UNITS_MAP[unit as Exclude<Unit, null>] : "";
    },
    [isI18nReady],
  );

  const translateUnitDeprecated = useCallback(
    (unit: Unit): string => {
      const units = locales[locale].units;

      const text = units[unit as keyof UnitsLocale];
      if (!text) {
        captureError(new Error(`Missing unit locale for ${unit}`));
        return unit !== null ? (unit as string) : "";
      }

      return text;
    },
    [locale],
  );

  return isI18NextOn ? translateUnit : translateUnitDeprecated;
};
