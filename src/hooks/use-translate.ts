import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocale } from "src/hooks/use-locale";
import { useAtomValue } from "jotai";
import { translationOverridesAtom } from "src/state/translation-overrides";
import "src/infra/i18n/i18next-config";

export type TranslateFn = {
  (key: string, count: number, ...variables: string[]): string;
  (key: string, ...variables: string[]): string;
};

export const useTranslate = (): TranslateFn => {
  const { t } = useTranslation();
  const { isI18nReady } = useLocale();
  const overrides = useAtomValue(translationOverridesAtom);

  const translate = useCallback<TranslateFn>(
    (key: string, ...args: (number | string)[]): string => {
      if (!isI18nReady) {
        return key;
      }

      const override = overrides[key];

      let resolvedKey = key;
      // When an override is registered, its variables are prepended to the
      // caller-supplied args so the caller only needs to pass non-injected params
      // (e.g. the unit), while the override injects the chemical name automatically.
      const resolvedArgs: (number | string)[] = override
        ? [...(override.variables ?? []), ...args]
        : args;

      if (override) {
        resolvedKey = override.key;
      }

      let count: number | undefined;
      let variables: string[] = [];

      if (typeof resolvedArgs[0] === "number") {
        count = resolvedArgs[0];
        variables = resolvedArgs.slice(1) as string[];
      } else {
        variables = resolvedArgs as string[];
      }

      const interpolationOptions: Record<string, string> = {};
      variables.forEach((variable, index) => {
        interpolationOptions[`${index + 1}`] = variable;
      });

      if (typeof count === "number") {
        return t(resolvedKey, { count, ...interpolationOptions });
      }

      return t(resolvedKey, interpolationOptions);
    },
    [t, isI18nReady, overrides],
  );

  return translate;
};
