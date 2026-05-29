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
        "flex-none flex border-b bg-popover border",
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
        `px-4 h-8
        border-b-2 border-transparent
        focus:outline-hidden focus-visible:ring-1 focus-visible:ring-inset
        transition-colors`,
        `text-size-base text-subtle
           hover:text-default
           hover:bg-base-hover
           data-[state=active]:text-accent
           data-[state=active]:border-accent
           focus-visible:ring-accent`,
        className,
      )}
      {...props}
    />
  );
}
