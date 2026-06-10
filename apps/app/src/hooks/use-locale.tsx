import {
  LocaleProvider as LibLocaleProvider,
  TranslationOverridesProvider,
} from "@epanet-js/i18n";
import { useAtomValue } from "jotai";
import { useUserSettings } from "src/hooks/use-user-settings";
import i18n from "src/infra/i18n/i18next-config";
import { captureError } from "src/infra/error-tracking";
import { notify } from "src/components/notifications";
import { ErrorIcon } from "src/icons";
import { translationOverridesAtom } from "src/state/translation-overrides";

export { useLocale } from "@epanet-js/i18n";

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  const { locale, setLocale } = useUserSettings();
  const overrides = useAtomValue(translationOverridesAtom);

  return (
    <LibLocaleProvider
      i18n={i18n}
      locale={locale}
      setUserLocale={setLocale}
      onError={(error) => {
        captureError(error as Error);
        notify({
          variant: "error",
          title: "Error",
          Icon: ErrorIcon,
        });
      }}
    >
      <TranslationOverridesProvider value={overrides}>
        {children}
      </TranslationOverridesProvider>
    </LibLocaleProvider>
  );
};
