import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { projectSettingsAtom } from "src/state/project-settings";
import { getDecimals } from "@epanet-js/project-settings";
import { localizeDecimal } from "@epanet-js/i18n";
import type { QuantityProperty } from "@epanet-js/project-settings";

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
