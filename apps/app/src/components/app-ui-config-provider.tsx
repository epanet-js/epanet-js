import { useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { UIProvider } from "@epanet-js/ui-kit";

export function AppUIConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const translate = useTranslate();
  const isSelectorVirtualizationEnabled = useFeatureFlag("FLAG_VIRT_SELECTOR");
  const config = useMemo(
    () => ({
      searchPlaceholder: translate("search"),
      selectorAddNewValueTemplate: translate("addNewValue", "{{1}}"),
      noResultsLabel: translate("noResults"),
      searchingLabel: translate("loading"),
      isSelectorVirtualizationEnabled,
    }),
    [translate, isSelectorVirtualizationEnabled],
  );
  return <UIProvider config={config}>{children}</UIProvider>;
}
