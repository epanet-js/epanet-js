import { useTranslateWith } from "@epanet-js/i18n";
import { useLocale } from "src/hooks/use-locale";
import "src/infra/i18n/i18next-config";

export type { TranslateFn } from "@epanet-js/i18n";

export const useTranslate = () => useTranslateWith(useLocale().isI18nReady);
