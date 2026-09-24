import { useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { UIProvider } from "@epanet-js/ui-kit";

export function AppUIConfigProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const translate = useTranslate();
  const config = useMemo(
    () => ({
      searchPlaceholder: translate("search"),
      selectorAddNewValueTemplate: translate("addNewValue", "{{1}}"),
      noResultsLabel: translate("noResults"),
      searchingLabel: translate("loading"),
    }),
    [translate],
  );
  return <UIProvider config={config}>{children}</UIProvider>;
}
