"use client";
import clsx from "clsx";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type Variant = "success" | "warning" | "error" | "info";

const rawColors: Record<Variant, { bg: string; title: string; body: string }> =
  {
    success: {
      bg: "bg-green-50 border-green-200",
      title: "text-green-700",
      body: "text-green-600",
    },
    warning: {
      bg: "bg-orange-50 border-orange-200",
      title: "text-orange-700",
      body: "text-orange-600",
    },
    error: {
      bg: "bg-red-50 border-red-200",
      title: "text-red-700",
      body: "text-red-600",
    },
    info: {
      bg: "bg-blue-50 border-blue-200",
      title: "text-blue-700",
      body: "text-blue-600",
    },
  };

const tokenColors: Record<
  Variant,
  { bg: string; title: string; body: string }
> = {
  success: {
    bg: "bg-success-subtle border-success",
    title: "text-success",
    body: "text-default",
  },
  warning: {
    bg: "bg-warning-subtle border-warning",
    title: "text-warning",
    body: "text-default",
  },
  error: {
    bg: "bg-error-subtle border-error",
    title: "text-error",
    body: "text-default",
  },
  info: {
    bg: "bg-info-subtle border-info",
    title: "text-info",
    body: "text-default",
  },
};

export const Message = ({
  variant,
  size = "auto",
  title,
  children,
}: {
  variant: Variant;
  title: string;
  size?: "auto" | "sm" | "md";
  children: React.ReactNode;
}) => {
  const isThemeTokensOn = useFeatureFlag("FLAG_THEME_TOKENS");
  const color = isThemeTokensOn ? tokenColors[variant] : rawColors[variant];

  return (
    <div
      className={clsx(
        {
          "w-[420px]": size === "md",
          "w-[300px]": size === "sm",
          "w-auto": size === "auto",
        },
        "flex items-start p-3 border rounded-lg shadow-md",
        color.bg,
      )}
    >
      <div className="flex flex-col flex-grow space-y-1">
        <span
          className={clsx(
            isThemeTokensOn ? "text-size-base" : "text-sm",
            "font-semibold",
            color.title,
          )}
        >
          {title}
        </span>
        <div
          className={clsx(
            isThemeTokensOn ? "text-size-base" : "text-sm",
            color.body,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
