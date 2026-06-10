import { createContext, useContext } from "react";

export type TranslationOverride = {
  key: string;
  variables?: string[];
};

export type TranslationOverridesMap = Record<string, TranslationOverride>;

export const TranslationOverridesContext =
  createContext<TranslationOverridesMap>({});

export const TranslationOverridesProvider =
  TranslationOverridesContext.Provider;

export const useTranslationOverrides = (): TranslationOverridesMap =>
  useContext(TranslationOverridesContext);
