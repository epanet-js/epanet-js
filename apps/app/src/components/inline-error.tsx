"use client";
import clsx from "clsx";
import { InfoIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export function InlineError({ children }: React.PropsWithChildren<unknown>) {
  const isThemeTokensOn = useFeatureFlag("FLAG_THEME_TOKENS");
  return (
    <div
      role="alert"
      className={clsx(
        "pt-1 flex items-start gap-x-1",
        isThemeTokensOn
          ? "text-size-base text-error"
          : "text-sm text-red-700 dark:text-red-300",
      )}
    >
      <InfoIcon style={{ marginTop: 2 }} />
      {Array.isArray(children) ? children.join(", ") : children}
    </div>
  );
}
