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
  "z-20 max-w-md rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 shadow-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white";

const CONTRAST_STYLE =
  "z-20 max-w-48 rounded-sm bg-gray-900 px-2 py-1 text-size-small text-white shadow-lg dark:bg-white dark:text-gray-900";

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
      <RadixTooltip.Arrow className="fill-gray-900 dark:fill-white" />
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
