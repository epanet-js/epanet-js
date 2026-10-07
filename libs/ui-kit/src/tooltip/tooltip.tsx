import * as RadixTooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from "react";

export const TooltipProvider = RadixTooltip.Provider;

export type TooltipVariant = "default" | "contrast";

type ContentProps = ComponentPropsWithoutRef<typeof RadixTooltip.Content>;

const DEFAULT_STYLE =
  "z-20 max-w-md rounded border bg-popover px-2 py-1 text-size-base text-default shadow-xs";

const CONTRAST_STYLE =
  "z-20 max-w-48 rounded-sm bg-popover-inverse px-2 py-1 text-size-small text-default-inverse shadow-lg";

const TooltipContent = forwardRef<
  ElementRef<typeof RadixTooltip.Content>,
  ContentProps & { variant?: TooltipVariant }
>(({ variant = "default", className, children, ...props }, ref) => (
  <RadixTooltip.Content
    ref={ref}
    className={clsx(
      variant === "contrast" ? CONTRAST_STYLE : DEFAULT_STYLE,
      className,
    )}
    {...props}
  >
    {children}
    {variant === "contrast" && (
      <RadixTooltip.Arrow className="fill-popover-inverse" />
    )}
  </RadixTooltip.Content>
));
TooltipContent.displayName = "TooltipContent";

export function Tooltip({
  content,
  children,
  variant = "default",
  side = "bottom",
  sideOffset,
  align,
  delayDuration = 200,
  open,
  onOpenChange,
  zIndex,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  variant?: TooltipVariant;
  className?: string;
  side?: ContentProps["side"];
  sideOffset?: ContentProps["sideOffset"];
  align?: ContentProps["align"];
  delayDuration?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  zIndex?: number;
}) {
  return (
    <RadixTooltip.Root
      delayDuration={delayDuration}
      open={open}
      onOpenChange={onOpenChange}
    >
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <TooltipContent
          variant={variant}
          side={side}
          sideOffset={sideOffset}
          align={align}
          className={className}
          style={zIndex === undefined ? undefined : { zIndex }}
        >
          {content}
        </TooltipContent>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
