import { forwardRef, memo, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import { Tooltip } from "@epanet-js/ui-kit";

export type RailSide = "left" | "right";

export const RailTabList = ({
  side = "left",
  children,
}: {
  side?: RailSide;
  children: ReactNode;
}) => (
  <Tabs.List
    className={clsx(
      "flex-none w-10 flex flex-col bg-popover overflow-y-auto scrollbar-hidden",
      side === "left" ? "border-r" : "border-l",
    )}
  >
    {children}
  </Tabs.List>
);

export const RailTab = memo(
  forwardRef<
    React.ElementRef<typeof Tabs.Trigger>,
    React.ComponentPropsWithoutRef<typeof Tabs.Trigger> & {
      label: string;
      icon: ReactNode;
      side?: RailSide;
    }
  >(function RailTab({ label, icon, side = "left", className, ...props }, ref) {
    return (
      <Tooltip
        content={label}
        side={side === "left" ? "right" : "left"}
        sideOffset={4}
      >
        <Tabs.Trigger
          ref={ref}
          aria-label={label}
          className={clsx(
            `flex-none h-10 w-full inline-flex items-center justify-center
              border-transparent
              focus:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent
              transition-colors
              text-default hover:bg-base-hover
              aria-selected:text-accent aria-selected:border-accent`,
            side === "left" ? "border-r-2" : "border-l-2",
            className,
          )}
          {...props}
        >
          {icon}
        </Tabs.Trigger>
      </Tooltip>
    );
  }),
);
