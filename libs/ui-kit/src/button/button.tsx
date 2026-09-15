import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";
import type { ClassValue } from "clsx";

export type ButtonSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl";
export type ButtonVariant =
  | "default"
  | "primary"
  | "blue"
  | "quiet"
  | "code"
  | "quiet/mode"
  | "quiet/list"
  | "destructive"
  | "danger"
  | "danger-quiet"
  | "ultra-quiet"
  | "success";
export type ButtonSide = "default" | "left" | "right" | "middle";

export const sharedPadding = (
  size: ButtonSize,
  side: ButtonSide = "default",
): ClassValue => ({
  "p-0 text-xs rounded-sm": size === "xxs",
  "py-0.5 px-1.5 text-xs rounded-sm": size === "xs",
  "py-1 px-2 text-sm rounded-sm": size === "sm",
  "py-1 px-3 text-md rounded-sm": size === "md",
  "rounded-l-none": side === "right",
  "rounded-r-none": side === "left",
  "rounded-none": side === "middle",
});

export function sharedOutline(
  variant: ButtonVariant,
  disabled = false,
): ClassValue {
  return [
    `
    outline-hidden

  `,
    disabled
      ? ""
      : variant === "danger"
        ? `focus-visible:ring-1
    focus-visible:ring-offset-1
    focus-visible:ring-error`
        : variant === "blue"
          ? `focus-visible:ring-1
    focus-visible:ring-offset-1
    focus-visible:ring-info`
          : `focus-visible:ring-1
    focus-visible:ring-offset-1
    focus-visible:ring-accent`,

    {
      [`border border-accent`]: variant === "primary",
      [`hover:border-accent-hover`]: variant === "primary" && !disabled,
      [`border border-blue-500`]: variant === "blue",
      [`border border-strong shadow-xs`]: variant === "default",
      [`focus-visible:border-base hover:border-base`]:
        variant === "default" && !disabled,
      [`border border-red-200 dark:border-red-300`]: variant === "destructive",
      [`focus-visible:border-red-500   dark:focus-visible:border-red-300
    hover:border-red-300   dark:hover:border-red-300
  `]: variant === "destructive" && !disabled,
      [`border border-green-500`]: variant === "success",
      [`border border-red-700`]: variant === "danger",
    },
  ];
}

const sharedBackground = (
  variant: ButtonVariant,
  disabled = false,
): ClassValue => {
  switch (variant) {
    case "primary":
    case "code":
      return [
        `bg-accent`,
        !disabled && `hover:bg-accent-hover hover:shadow-sm`,
      ];
    case "blue":
      return [
        `bg-blue-600`,
        !disabled && `hover:bg-blue-700 dark:hover:bg-blue-500 hover:shadow-sm`,
      ];
    case "default":
      return [`bg-base`, !disabled && `hover:bg-base-hover`];
    case "quiet":
      return !disabled && `hover:bg-base-hover`;
    case "ultra-quiet":
      return !disabled && `hover:bg-base-hover`;
    case "quiet/mode":
      return !disabled && `hover:bg-base-hover`;
    case "quiet/list":
      return !disabled && `hover:bg-base-hover`;
    case "destructive":
    case "danger-quiet":
      return !disabled && `hover:bg-error-subtle`;
    case "success":
      return [
        `bg-green-500`,
        !disabled &&
          `hover:bg-green-600 dark:hover:bg-green-400 hover:shadow-sm`,
      ];
    case "danger":
      return [
        `bg-red-700`,
        !disabled && `hover:bg-red-600 dark:hover:bg-red-400 hover:shadow-sm`,
      ];
  }
};

export const sharedText = (variant: ButtonVariant): ClassValue => {
  switch (variant) {
    case "quiet":
    case "code":
    case "quiet/mode":
    case "quiet/list":
    case "danger-quiet":
    case "default": {
      return "font-medium text-default";
    }
    case "ultra-quiet":
      return "text-subtle hover:text-default";
    case "primary": {
      return "font-medium text-white";
    }
    case "blue": {
      return "font-medium text-white";
    }
    case "destructive": {
      return "font-medium text-error";
    }
    case "success": {
      return "font-medium text-white";
    }
    case "danger": {
      return "font-medium text-white";
    }
  }
};

export const styledButton = ({
  size = "sm",
  variant = "default",
  disabled = false,
  side = "default",
  textAlign = "center",
}: {
  size?: ButtonSize | "full-width";
  variant?: ButtonVariant;
  disabled?: boolean;
  side?: ButtonSide;
  textAlign?: "start" | "center";
}) =>
  clsx(
    variant === "quiet/list"
      ? `
    aria-expanded:bg-base-hover
    aria-selected:bg-accent-tint
    aria-selected:hover:bg-accent-tint
    transition-colors
    `
      : variant === "quiet/mode"
        ? `aria-expanded:bg-accent aria-expanded:text-white
    data-[state=on]:bg-accent dark:data-[state=on]:bg-gray-900`
        : variant === "primary"
          ? `aria-expanded:bg-accent-hover
    data-[state=on]:bg-accent-hover`
          : variant === "blue"
            ? `aria-expanded:bg-blue-700
    data-[state=on]:bg-blue-700`
            : `
    aria-expanded:bg-base-hover
    data-[state=on]:bg-base-hover`,
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "transition-colors",
    // Focus
    `focus-visible:outline-hidden`,
    // Sizing
    sharedPadding(size === "full-width" ? "md" : size, side),
    // Display
    `inline-flex items-center gap-x-1`,
    // Transition
    // `transition-all`,
    // Text
    sharedText(variant),
    // Outline
    sharedOutline(variant, disabled),
    sharedBackground(variant, disabled),
    size === "full-width" &&
      `flex-auto w-full ${textAlign === "start" ? "justify-start" : "justify-center"}`,
    // Colored variants
    variant === "danger-quiet" &&
      `[&>svg]:text-error [&>svg]:hover:text-red-600 dark:[&>svg]:hover:text-red-400`,
  );

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize | "full-width";
  variant?: ButtonVariant;
  side?: ButtonSide;
  textAlign?: "start" | "center";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { size, variant, side, textAlign, disabled, className, type, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled}
      className={clsx(
        styledButton({ size, variant, disabled, side, textAlign }),
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
