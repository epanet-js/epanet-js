import * as Tabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const TabRoot = Tabs.Root;

export function TabList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Tabs.List>) {
  const isThemeTokensOn = useFeatureFlag("FLAG_THEME_TOKENS");
  return (
    <Tabs.List
      className={clsx(
        "flex-none flex border-b",
        isThemeTokensOn
          ? "bg-popover border"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
        className,
      )}
      {...props}
    />
  );
}

export function Tab({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Tabs.Trigger>) {
  const isThemeTokensOn = useFeatureFlag("FLAG_THEME_TOKENS");
  return (
    <Tabs.Trigger
      className={clsx(
        `px-4 h-8
        border-b-2 border-transparent
        focus:outline-hidden focus-visible:ring-1 focus-visible:ring-inset
        transition-colors`,
        isThemeTokensOn
          ? `text-size-base text-subtle
             hover:text-default
             hover:bg-base-hover
             data-[state=active]:text-accent
             data-[state=active]:border-accent
             focus-visible:ring-accent`
          : `text-sm text-gray-500 dark:text-gray-400
             hover:text-gray-800 dark:hover:text-gray-200
             hover:bg-gray-100 dark:hover:bg-gray-700/50
             data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400
             data-[state=active]:border-purple-600 dark:data-[state=active]:border-purple-400
             focus-visible:ring-purple-500`,
        className,
      )}
      {...props}
    />
  );
}
