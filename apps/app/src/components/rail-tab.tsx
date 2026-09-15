import { forwardRef, memo, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import { TContent } from "src/components/elements";

export const RailTabList = ({ children }: { children: ReactNode }) => (
  <Tabs.List className="flex-none w-10 flex flex-col border-r bg-popover overflow-y-auto scrollbar-hidden">
    {children}
  </Tabs.List>
);

export const RailTab = memo(
  forwardRef<
    React.ElementRef<typeof Tabs.Trigger>,
    React.ComponentPropsWithoutRef<typeof Tabs.Trigger> & {
      label: string;
      icon: ReactNode;
    }
  >(function RailTab({ label, icon, className, ...props }, ref) {
    return (
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger asChild>
          <Tabs.Trigger
            ref={ref}
            aria-label={label}
            className={clsx(
              `flex-none h-10 w-full inline-flex items-center justify-center
              border-r-2 border-transparent
              focus:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent
              transition-colors
              text-default hover:bg-base-hover
              aria-selected:text-accent aria-selected:border-accent`,
              className,
            )}
            {...props}
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
  }),
);
