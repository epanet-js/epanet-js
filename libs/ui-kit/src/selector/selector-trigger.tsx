import clsx from "clsx";
import React, { useMemo } from "react";
import { ChevronDownIcon } from "../icons";

export type StyleOptions = {
  border?: boolean;
  textSize?: "text-xs" | "text-sm" | "text-size-small" | "text-size-base";
  paddingX?: number;
  paddingY?: number;
  disableHoverEffects?: boolean;
  variant?: "default" | "warning";
};

const defaultStyleOptions: StyleOptions = {
  border: true,
  textSize: "text-size-base",
  paddingX: 2,
  paddingY: 2,
};

export const triggerStylesFor = (
  styleOptions: StyleOptions,
  { disabled = false } = {},
) => {
  const effectiveStyleOptions = { ...defaultStyleOptions, ...styleOptions };
  const isWarning = effectiveStyleOptions.variant === "warning";
  return clsx(
    "flex items-center gap-x-2 w-full",
    disabled
      ? "text-subtle cursor-not-allowed bg-base-disabled"
      : "text-default bg-base",
    !disabled &&
      !effectiveStyleOptions.disableHoverEffects &&
      "focus:justify-between hover:border hover:rounded-xs hover:justify-between min-w-[90px]",
    "border rounded-xs justify-between",
    isWarning
      ? "border-orange-500 dark:border-orange-700"
      : !effectiveStyleOptions.border && "border-transparent",
    `px-${effectiveStyleOptions.paddingX} py-${effectiveStyleOptions.paddingY}`,
    effectiveStyleOptions.textSize,
    "pl-min-2",
    !disabled &&
      !effectiveStyleOptions.disableHoverEffects &&
      (isWarning
        ? "focus:ring-inset focus:ring-1 focus:ring-orange-500 dark:focus:ring-orange-700"
        : "focus:ring-inset focus:ring-1 focus:ring-accent focus:bg-purple-300/10"),
  );
};

export const resolveTextSize = (styleOptions: StyleOptions): string =>
  styleOptions.textSize ?? defaultStyleOptions.textSize!;

export const SelectorLikeButton = React.forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode;
    ariaLabel?: string;
    tabIndex?: number;
    styleOptions?: StyleOptions;
    disabled?: boolean;
  }
>(
  (
    {
      children,
      ariaLabel,
      tabIndex = 1,
      styleOptions = {},
      disabled = false,
      ...props
    },
    forwardedRef,
  ) => {
    const triggerStyles = useMemo(() => {
      return triggerStylesFor(styleOptions, { disabled });
    }, [styleOptions, disabled]);

    return (
      <button
        ref={forwardedRef}
        aria-label={ariaLabel}
        tabIndex={tabIndex}
        disabled={disabled}
        className={triggerStyles}
        {...props}
      >
        <div className="text-nowrap overflow-hidden text-ellipsis">
          {children}
        </div>
        <div className="px-1">
          <ChevronDownIcon />
        </div>
      </button>
    );
  },
);
