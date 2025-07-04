import { useAtomValue } from "jotai";
import { localeAtom } from "src/state/locale";
import { Translations } from "src/infra/i18n/locales/locale";
import { locales } from "src/infra/i18n/locale";
import { captureError } from "src/infra/error-tracking";

const compileText = (template: string, variables: string[]): string => {
  let result = template;
  variables.forEach((variable, i) => {
    result = result.replace(`$\{${i + 1}}`, variable);
  });
  return result;
};

export const useTranslate = () => {
  const locale = useAtomValue(localeAtom);

  return (key: string, ...variables: string[]): string => {
    const translations = locales[locale].translations;
    const template = translations[key as keyof Translations];
    if (!template) {
      captureError(new Error(`Missing translation for ${key}`));
      return key;
    }

    const text = compileText(template, variables);
    return text;
  };
};
