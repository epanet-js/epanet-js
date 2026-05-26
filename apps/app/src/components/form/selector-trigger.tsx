import clsx from "clsx";
import React, { useMemo } from "react";
import { ChevronDownIcon } from "src/icons";

export type StyleOptions = {
  border?: boolean;
  textSize?: "text-xs" | "text-sm";
  paddingX?: number;
  paddingY?: number;
  disableHoverEffects?: boolean;
  variant?: "default" | "warning";
};

const defaultStyleOptions: StyleOptions = {
  border: true,
  textSize: "text-sm",
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
      ? "text-gray-500 dark:text-gray-500 cursor-not-allowed bg-gray-100 dark:bg-gray-800"
      : "text-gray-700 bg-white dark:bg-gray-900",
    !disabled &&
      !effectiveStyleOptions.disableHoverEffects &&
      "focus:justify-between hover:border hover:rounded-xs hover:border-gray-200 hover:justify-between min-w-[90px]",
    "border rounded-xs justify-between",
    isWarning
      ? "border-orange-500 dark:border-orange-700"
      : {
          "border-gray-200": effectiveStyleOptions.border,
          "border-transparent": !effectiveStyleOptions.border,
        },
    `px-${effectiveStyleOptions.paddingX} py-${effectiveStyleOptions.paddingY}`,
    effectiveStyleOptions.textSize,
    "pl-min-2",
    !disabled &&
      !effectiveStyleOptions.disableHoverEffects &&
      (isWarning
        ? "focus:ring-inset focus:ring-1 focus:ring-orange-500 dark:focus:ring-orange-700"
        : "focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10"),
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
  }
>(
  (
    { children, ariaLabel, tabIndex = 1, styleOptions = {}, ...props },
    forwardedRef,
  ) => {
    const triggerStyles = useMemo(() => {
      return triggerStylesFor(styleOptions);
    }, [styleOptions]);

    return (
      <button
        ref={forwardedRef}
        aria-label={ariaLabel}
        tabIndex={tabIndex}
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
