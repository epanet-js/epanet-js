import { Translations, UnitsLocale } from "./locales/locale";
import { captureError } from "../error-tracking";
import { Locale, getLocale, locales } from "./locale";
import { getDefaultStore } from "jotai";
import { localeAtom } from "src/state/locale";

export const translate = (key: string, ...variables: string[]): string => {
  let locale: Locale;
  try {
    const store = getDefaultStore();
    locale = store.get(localeAtom);
  } catch (error) {
    locale = "en";
  }

  const translations = locales[locale].translations;
  const template = translations[key as keyof Translations];
  if (!template) {
    captureError(new Error(`Missing translation for ${key}`));
    return key;
  }

  const text = compileText(template, variables);
  return text;
};

export const translateUnit = (key: string): string => {
  let locale;
  try {
    const store = getDefaultStore();
    locale = store.get(localeAtom);
  } catch {
    locale = getLocale();
  }

  const units = locales[locale].units;

  const text = units[key as keyof UnitsLocale];
  if (!text) {
    captureError(new Error(`Missing unit locale for ${key}`));
  }

  return text || key;
};

const compileText = (template: string, variables: string[]): string => {
  let result = template;
  variables.forEach((variable, i) => {
    result = result.replace(`$\{${i + 1}}`, variable);
  });
  return result;
};

export { parseLocaleNumber, reformatWithoutGroups } from "./locale-number";
export { localizeKeybinding } from "./mac";
