import * as Tabs from "@radix-ui/react-tabs";
import clsx from "clsx";

export const TabRoot = Tabs.Root;

export function TabList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Tabs.List>) {
  return (
    <Tabs.List
      className={clsx(
        "flex-none flex bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700",
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
  return (
    <Tabs.Trigger
      className={clsx(
        `px-4 h-10 text-sm font-medium tracking-wide
        text-gray-500 dark:text-gray-400
        hover:text-gray-800 dark:hover:text-gray-200
        hover:bg-gray-100 dark:hover:bg-gray-700/50
        data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400
        border-b-2 border-transparent
        data-[state=active]:border-purple-600 dark:data-[state=active]:border-purple-400
        focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-purple-500
        transition-colors`,
        className,
      )}
      {...props}
    />
  );
}
