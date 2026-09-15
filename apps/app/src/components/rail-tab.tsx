import { memo, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import { TContent } from "src/components/elements";

export const RailTabList = ({ children }: { children: ReactNode }) => (
  <Tabs.List className="flex-none w-8 flex flex-col border-r bg-popover overflow-y-auto scrollbar-hidden">
    {children}
  </Tabs.List>
);

export const RailTab = memo(function RailTab({
  id,
  label,
  icon,
}: {
  id: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>
        <Tabs.Trigger
          value={id}
          aria-label={label}
          className="flex-none h-8 w-full inline-flex items-center justify-center
            border-r-2 border-transparent
            focus:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent
            transition-colors
            text-default hover:bg-base-hover
            aria-selected:text-accent aria-selected:border-accent"
        >
          {icon}
        </Tabs.Trigger>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <TContent side="right" sideOffset={4}>
          {label}
        </TContent>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});
