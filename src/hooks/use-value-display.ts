import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { dataAtom } from "src/state/data";
import { getDecimals } from "src/model-metadata";
import { localizeDecimal } from "src/infra/i18n/numbers";
import type { QuantityProperty } from "src/model-metadata/quantities-spec";

export const useValueDisplay = () => {
  const {
    modelMetadata: { formatting },
  } = useAtomValue(dataAtom);

  const displayValue = useCallback(
    (value: number | null, property: QuantityProperty): string => {
      if (value === null) return "";
      return localizeDecimal(value, {
        decimals: getDecimals(formatting, property),
      });
    },
    [formatting],
  );

  return { displayValue };
};
