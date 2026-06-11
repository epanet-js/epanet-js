import { useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { UIProvider } from "src/lib/ui-kit/ui-config";

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
    }),
    [translate],
  );
  return <UIProvider config={config}>{children}</UIProvider>;
}
