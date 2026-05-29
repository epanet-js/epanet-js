"use client";
import clsx from "clsx";

type Variant = "success" | "warning" | "error" | "info";

const colors: Record<Variant, { bg: string; title: string; body: string }> = {
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
  const color = colors[variant];

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
      <div className="flex flex-col grow space-y-1">
        <span
          className={clsx(
            "text-size-base",
            "font-semibold",
            color.title,
          )}
        >
          {title}
        </span>
        <div
          className={clsx(
            "text-size-base",
            color.body,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
