import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { projectSettingsAtom } from "src/state/project-settings";
import { getDecimals } from "src/lib/project-settings";
import { localizeDecimal } from "src/infra/i18n/numbers";
import type { QuantityProperty } from "src/lib/project-settings/quantities-spec";

export const useValueDisplay = () => {
  const { formatting } = useAtomValue(projectSettingsAtom);

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
