import clsx from "clsx";
import { X } from "lucide-react";
import { Button, type ButtonVariant } from "../button/button";

export type CalloutVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "default";

export type CalloutAction = {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  align?: "left" | "center" | "right" | "inline";
};

type CalloutProps = {
  variant: CalloutVariant;
  title?: string;
  description?: string;
  details?: string;
  Icon?: React.ElementType;
  className?: string;
  action?: CalloutAction;
  onActionClick?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  children?: React.ReactNode;
};

export const Callout = ({
  variant,
  title,
  description,
  details,
  Icon,
  className,
  action,
  onActionClick,
  onDismiss,
  dismissLabel = "Dismiss",
  children,
}: CalloutProps) => {
  const isInlineAction = action?.align === "inline";
  const hasTitleRowExtras = isInlineAction || !!onDismiss;
  return (
    <div
      className={clsx(
        "flex items-start p-3",
        {
          "bg-success-subtle border-success": variant === "success",
          "bg-warning-subtle border-warning": variant === "warning",
          "bg-error-subtle border-error": variant === "error",
          "bg-info-subtle border-info": variant === "info",
          "bg-popover border-strong": variant === "default",
        },
        className,
      )}
    >
      {Icon && (
        <Icon
          className={clsx("h-4 w-4 mt-0.5 mr-2 shrink-0", {
            "text-success": variant === "success",
            "text-error": variant === "error",
            "text-warning": variant === "warning",
            "text-info": variant === "info",
          })}
          aria-hidden="true"
        />
      )}
      <div className="flex flex-col grow space-y-1 min-w-0">
        {(title || hasTitleRowExtras) &&
          (hasTitleRowExtras ? (
            <div className="flex items-center gap-2">
              {title && (
                <span className="text-size-base font-semibold grow min-w-0">
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
                  className="shrink-0 p-1 rounded-md inline-flex items-center justify-center text-default hover:text-subtle hover:cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-accent"
                >
                  <span className="sr-only">{dismissLabel}</span>
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            title && (
              <span className="text-size-base font-semibold">{title}</span>
            )
          ))}
        {description && (
          <span className="text-size-base whitespace-pre-line">
            {description}
          </span>
        )}
        {children && <div className="text-size-base">{children}</div>}
        {details && (
          <details className="text-size-small">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
              Show details
            </summary>
            <pre className="mt-1 whitespace-pre-wrap wrap-break-word font-mono text-default bg-white/60 rounded-sm p-2 max-h-40 overflow-auto">
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
