import { useAtomValue } from "jotai";
import { localeAtom } from "src/state/locale";
import { Translations } from "src/infra/i18n/locales/locale";
import { locales } from "src/infra/i18n/locale";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocale } from "src/hooks/use-locale";
import "src/infra/i18n/i18next-config";

const compileText = (template: string, variables: string[]): string => {
  let result = template;
  variables.forEach((variable, i) => {
    result = result.replace(`$\{${i + 1}}`, variable);
  });
  return result;
};

export const useTranslate = () => {
  const locale = useAtomValue(localeAtom);
  const isI18NextOn = useFeatureFlag("FLAG_I18NEXT");
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

  const translateDeprecated = useCallback(
    (key: string, ...variables: string[]): string => {
      const translations = locales[locale].translations;
      const template = translations[key as keyof Translations];
      if (!template) {
        captureError(new Error(`Missing translation for ${key}`));
        return key;
      }

      const text = compileText(template, variables);
      return text;
    },
    [locale],
  );

  return isI18NextOn ? translate : translateDeprecated;
};
