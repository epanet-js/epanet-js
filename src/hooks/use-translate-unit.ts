import { Unit } from "src/quantity";
import { useCallback } from "react";
import { useLocale } from "src/hooks/use-locale";

const UNITS_MAP: Record<Exclude<Unit, null>, string> = {
  m: "m",
  mm: "mm",
  in: "in",
  ft: "ft",
  "l/s": "l/s",
  "l/h": "l/h",
  "l/d": "l/d",
  km: "km",
  "gal/min": "gal/min",
  "gal/d": "gal/d",
  psi: "psi",
  mwc: "m",
  "m/s": "m/s",
  "ft/s": "ft/s",
  "ft^3": "ft³",
  "ft^3/s": "ft³/s",
  "ft^3/d": "ft³/d",
  "l/min": "l/min",
  "Mgal/d": "Mgal/d",
  "IMgal/d": "IMgal/d",
  "Ml/d": "Ml/d",
  "m^3": "m³",
  "m^3/h": "m³/h",
  "m^3/d": "m³/d",
  "acft/d": "acft/d",
  hp: "hp",
  kW: "kW",
  "m/km": "m/km",
  "ft/kft": "ft/kft",
};

export const useTranslateUnit = () => {
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

  return translateUnit;
};
