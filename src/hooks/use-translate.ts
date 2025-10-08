import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocale } from "src/hooks/use-locale";
import "src/infra/i18n/i18next-config";

type TranslateFn = {
  (key: string, count: number, ...variables: string[]): string;
  (key: string, ...variables: string[]): string;
};

export const useTranslate = (): TranslateFn => {
  const { t } = useTranslation();
  const { isI18nReady } = useLocale();

  const translate = useCallback<TranslateFn>(
    (key: string, ...args: (number | string)[]): string => {
      if (!isI18nReady) {
        return key;
      }

      let count: number | undefined;
      let variables: string[] = [];

      if (typeof args[0] === "number") {
        count = args[0];
        variables = args.slice(1) as string[];
      } else {
        variables = args as string[];
      }

      const interpolationOptions: Record<string, string> = {};
      variables.forEach((variable, index) => {
        interpolationOptions[`${index + 1}`] = variable;
      });

      if (typeof count === "number") {
        return t(key, { count, ...interpolationOptions });
      }

      return t(key, interpolationOptions);
    },
    [t, isI18nReady],
  );

  return translate;
};
