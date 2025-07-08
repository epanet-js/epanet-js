import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocale } from "src/hooks/use-locale";
import "src/infra/i18n/i18next-config";

export const useTranslate = () => {
  const { t } = useTranslation();
  const { isI18nReady } = useLocale();

  const translate = useCallback(
    (key: string, ...variables: string[]): string => {
      if (!isI18nReady) {
        return key;
      }

      const interpolationOptions: Record<string, string> = {};
      variables.forEach((variable, index) => {
        interpolationOptions[`${index + 1}`] = variable;
      });

      return t(key, interpolationOptions);
    },
    [t, isI18nReady],
  );

  return translate;
};
