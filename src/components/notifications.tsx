"use client";
import clsx from "clsx";
import { CloseIcon } from "src/icons";
import toast, { Toaster } from "react-hot-toast";
import { Button, type B3Variant } from "src/components/elements";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

type NotificationVariant = "success" | "warning" | "error" | "default";

type NotificationAction = {
  label: string;
  onClick: () => void;
  variant?: B3Variant;
  align?: "left" | "center" | "right" | "inline";
};

type NotificationBannerProps = {
  variant: NotificationVariant;
  title?: string;
  description?: string;
  details?: string;
  Icon?: React.ElementType;
  className?: string;
  action?: NotificationAction;
  onActionClick?: () => void;
  onDismiss?: () => void;
};

export const NotificationBanner = ({
  variant,
  title,
  description,
  details,
  Icon,
  className,
  action,
  onActionClick,
  onDismiss,
}: NotificationBannerProps) => {
  const isThemeTokensOn = useFeatureFlag("FLAG_THEME_TOKENS");
  const isInlineAction = action?.align === "inline";
  const hasTitleRowExtras = isInlineAction || !!onDismiss;
  return (
    <div
      className={clsx(
        "flex items-start p-3",
        isThemeTokensOn
          ? {
              "bg-success-subtle border-success": variant === "success",
              "bg-warning-subtle border-warning": variant === "warning",
              "bg-error-subtle border-error": variant === "error",
              "bg-white border-gray-400": variant === "default",
            }
          : {
              "bg-green-50 border-green-200": variant === "success",
              "bg-orange-50 border-orange-200": variant === "warning",
              "bg-red-50 border-red-200": variant === "error",
              "bg-white border-gray-400": variant === "default",
            },
        className,
      )}
    >
      {Icon && (
        <Icon
          className={clsx(
            "h-5 w-5 mr-3 flex-shrink-0",
            isThemeTokensOn
              ? {
                  "text-success-icon": variant === "success",
                  "text-error-icon": variant === "error",
                  "text-warning-icon": variant === "warning",
                }
              : {
                  "text-green-500": variant === "success",
                  "text-red-500": variant === "error",
                  "text-orange-500": variant === "warning",
                },
          )}
          aria-hidden="true"
        />
      )}
      <div className="flex flex-col flex-grow space-y-1 min-w-0">
        {(title || hasTitleRowExtras) &&
          (hasTitleRowExtras ? (
            <div className="flex items-center gap-2">
              {title && (
                <span
                  className={clsx(
                    isThemeTokensOn ? "text-size-base" : "text-sm",
                    "font-semibold flex-grow min-w-0",
                  )}
                >
                  {title}
                </span>
              )}
              {isInlineAction && action && (
                <Button
                  variant={action.variant ?? "primary"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    action.onClick();
                    onActionClick?.();
                  }}
                >
                  {action.label}
                </Button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="shrink-0 p-1 rounded-md inline-flex items-center justify-center text-gray-700 hover:text-gray-500 hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                >
                  <span className="sr-only">Dismiss</span>
                  <CloseIcon />
                </button>
              )}
            </div>
          ) : (
            title && (
              <span
                className={clsx(
                  isThemeTokensOn ? "text-size-base" : "text-sm",
                  "font-semibold",
                )}
              >
                {title}
              </span>
            )
          ))}
        {description && (
          <span className={isThemeTokensOn ? "text-size-base" : "text-sm"}>
            {description}
          </span>
        )}
        {details && (
          <details className={isThemeTokensOn ? "text-size-small" : "text-xs"}>
            <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
              Show details
            </summary>
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-gray-700 bg-white/60 rounded p-2 max-h-40 overflow-auto">
              {details}
            </pre>
          </details>
        )}
        {action && action.align !== "inline" && (
          <Button
            variant={action.variant ?? "default"}
            size="sm"
            className={clsx("mt-1", {
              "self-start": !action.align || action.align === "left",
              "self-center": action.align === "center",
              "self-end": action.align === "right",
            })}
            onClick={() => {
              action.onClick();
              onActionClick?.();
            }}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
};

export default function Notifications({
  duration = 5000,
  successDuration = 3000,
}: {
  duration?: number;
  successDuration?: number;
}) {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        className:
          "dark:bg-gray-900 dark:text-white dark:ring-1 dark:ring-gray-500 rounded-md",
        duration,
        success: {
          duration: successDuration,
          iconTheme: {
            primary: "green",
            secondary: "white",
          },
        },
      }}
    />
  );
}

export const hideNotification = (id: string) => toast.remove(id);

export const notifyPromiseState = (
  promise: Promise<void>,
  {
    loading,
    success,
    error,
    duration = 2000,
  }: { loading: string; success: string; error: string; duration?: number },
) => {
  return toast.promise(
    promise,
    { loading, success, error },
    { success: { duration }, error: { duration } },
  );
};

export const notify = ({
  variant = "default",
  title,
  description,
  details,
  Icon,
  id,
  duration = 5000,
  position = "top-center",
  dismissable = true,
  size = "auto",
  action,
}: {
  variant?: NotificationVariant;
  title: string;
  description?: string;
  details?: string;
  Icon?: React.ElementType;
  id?: string;
  duration?: number;
  position?: "top-center" | "bottom-right" | "bottom-center";
  dismissable?: boolean;
  size?: "auto" | "sm" | "md";
  action?: NotificationAction;
}) => {
  return toast.custom(
    (t) => (
      <div
        className={clsx(
          "relative",
          {
            "w-[420px]": size === "md",
            "w-[300px]": size === "sm",
            "w-auto": size === "auto",
          },
          t.visible ? "animate-enter" : "animate-leave",
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        data-notification
      >
        <NotificationBanner
          variant={variant}
          title={title}
          description={description}
          details={details}
          Icon={Icon}
          action={action}
          onActionClick={() => toast.remove(t.id)}
          onDismiss={dismissable ? () => toast.remove(t.id) : undefined}
          className="shadow-md border rounded-lg"
        />
      </div>
    ),
    { id, duration, position },
  );
};
