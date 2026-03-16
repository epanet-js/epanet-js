import { Suspense, useCallback, type ReactNode } from "react";
import clsx from "clsx";
import {
  Button,
  DefaultErrorBoundary,
  Loading,
  StyledDialogContent,
  StyledDialogContentNew,
  StyledDialogOverlay,
} from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";

import * as Dialog from "@radix-ui/react-dialog";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { CloseIcon, RefreshIcon } from "src/icons";

export const useDialogState = () => {
  const setDialogState = useSetAtom(dialogAtom);

  const closeDialog = useCallback(() => {
    setDialogState(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("dialog");

    window.history.replaceState({}, "", url);
  }, [setDialogState]);

  return { closeDialog };
};

export const LoadingDialog = () => {
  const { closeDialog } = useDialogState();
  return (
    <BaseDialog size="xs" isOpen={true} onClose={closeDialog}>
      <Loading />
    </BaseDialog>
  );
};

export const DialogContainer = ({
  size = "sm",
  height,
  fillMode = "full",
  children,
  disableOutsideClick = false,
  onClose,
}: {
  size?: "sm" | "xs" | "md" | "lg" | "xl" | "fullscreen";
  height?: "sm" | "md" | "lg" | "xl" | "fullscreen";
  fillMode?: "full" | "auto";
  children: React.ReactNode;
  disableOutsideClick?: boolean;
  onClose?: () => void;
}) => {
  const { closeDialog } = useDialogState();
  const handleClose = onClose ?? closeDialog;

  return (
    <Dialog.Root
      open={!!children}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      }}
    >
      <Dialog.Trigger className="hidden">
        <div className="hidden"></div>
      </Dialog.Trigger>
      <Dialog.Portal>
        <StyledDialogOverlay />
        <Suspense fallback={<Loading />}>
          <Dialog.Title></Dialog.Title>
          <Dialog.Description></Dialog.Description>
          <StyledDialogContent
            widthClasses=""
            onEscapeKeyDown={(e) => {
              const target = e.target as HTMLElement;
              const isInputFocused =
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable;
              const shouldCaptureEscape = target.closest(
                "[data-capture-escape-key]",
              );
              if (isInputFocused || shouldCaptureEscape) {
                e.preventDefault();
                return;
              }
              e.stopPropagation();
              handleClose();
            }}
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("[data-privacy-banner]")) {
                e.preventDefault();
                return;
              }
              if (target.closest("[data-notification]")) {
                e.preventDefault();
                return;
              }
              if (disableOutsideClick) {
                e.preventDefault();
              }
            }}
            onOpenAutoFocus={(e) => e.preventDefault()}
            size={size}
            height={height}
            fillMode={fillMode}
          >
            <DefaultErrorBoundary>{children}</DefaultErrorBoundary>
          </StyledDialogContent>
        </Suspense>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const DialogCloseX = () => {
  return (
    <Dialog.Close
      aria-label="Close"
      className="text-gray-500 shrink-0
                  focus:bg-gray-200 dark:focus:bg-black
                  hover:text-black dark:hover:text-white"
    >
      <CloseIcon />
    </Dialog.Close>
  );
};

export function DialogHeader({
  title,
  children,
  badge,
}: {
  title?: string;
  children?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div
      className="
        flex items-center gap-x-2
        px-4 py-3
        text-base
        text-black dark:text-white
        border-b border-gray-200
      "
    >
      {children && children}
      {title && (
        <div className="flex items-center gap-3 flex-auto min-w-0">
          <h1 className="text-md font-semibold text-gray-900 break-words sm:truncate">
            {title}
          </h1>
          {badge && badge}
        </div>
      )}
      <div className="relative top-1">
        <DialogCloseX />
      </div>
    </div>
  );
}

interface BaseDialogProps {
  title?: string;
  size?: "sm" | "xs" | "md" | "lg" | "xl" | "fullscreen" | "auto";
  height?: "sm" | "md" | "lg" | "xl";
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  badge?: React.ReactNode;
  preventClose?: boolean;
}

export const BaseDialog = ({
  title,
  size = "auto",
  height,
  isOpen,
  onClose,
  children,
  footer,
  badge,
  preventClose = false,
}: BaseDialogProps) => {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => !open && !preventClose && onClose()}
    >
      <Dialog.Portal>
        <StyledDialogOverlay />
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <StyledDialogContentNew
            size={size}
            height={height}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onEscapeKeyDown={
              preventClose ? (e) => e.preventDefault() : undefined
            }
          >
            <DefaultErrorBoundary>
              <div className="modal-container flex flex-col flex-nowrap flex-1 min-h-0">
                {title && <DialogHeader title={title} badge={badge} />}
                <div className="modal-content flex flex-col flex-1 overflow-y-auto min-h-0">
                  {children}
                </div>
                {footer && <DialogFooter>{footer}</DialogFooter>}
              </div>
            </DefaultErrorBoundary>
          </StyledDialogContentNew>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const AckDialogAction = ({
  label,
  onAck,
}: {
  label?: string;
  onAck?: () => void;
}) => {
  const translate = useTranslate();
  return (
    <div
      className={clsx(
        "relative",
        "px-4 py-3 border-t border-gray-200",
        "flex flex-col sm:items-center sm:flex-row-reverse space-y-2 sm:space-y-0 sm:gap-x-3",
      )}
    >
      <Button autoFocus={true} type="button" onClick={onAck}>
        {label ? label : translate("dialog.cancel")}
      </Button>
    </div>
  );
};

export const DialogFooter = ({ children }: { children: ReactNode }) => {
  return children;
};

export function SimpleDialogActions({
  action,
  onAction,
  onClose,
  fullWidthSubmit = false,
  autoFocusSubmit = true,
  secondary,
  tertiary,
  isDisabled = false,
  isSubmitting = false,
  actionVariant = "primary",
}: {
  action?: string;
  onAction?: () => void;
  autoFocusSubmit?: boolean;
  onClose?: () => void;
  fullWidthSubmit?: boolean;
  secondary?: {
    action: string;
    onClick: () => void;
  };
  tertiary?: {
    action: string;
    onClick: () => void;
  };
  isDisabled?: boolean;
  isSubmitting?: boolean;
  actionVariant?: "primary" | "danger";
}) {
  const translate = useTranslate();
  return (
    <footer
      className={clsx(
        "relative",
        fullWidthSubmit
          ? "flex items-stretch justify-stretch"
          : `flex flex-col sm:items-center sm:flex-row-reverse gap-3 px-4 py-3 border-t border-gray-200`,
      )}
    >
      {action ? (
        <Button
          type={onAction ? "button" : "submit"}
          onClick={onAction}
          disabled={isSubmitting || isDisabled}
          variant={actionVariant}
          autoFocus={autoFocusSubmit}
          size={fullWidthSubmit ? "full-width" : "sm"}
        >
          {action}
        </Button>
      ) : null}
      {secondary ? (
        <Button
          type="button"
          disabled={isSubmitting}
          variant="default"
          onClick={secondary.onClick}
        >
          {secondary.action}
        </Button>
      ) : null}
      {tertiary ? (
        <Button
          type="button"
          disabled={isSubmitting}
          variant="default"
          onClick={tertiary.onClick}
        >
          {tertiary.action}
        </Button>
      ) : null}
      {onClose ? (
        <Button type="button" onClick={onClose}>
          {translate(action || secondary ? "dialog.cancel" : "dialog.close")}
        </Button>
      ) : null}
      <RefreshIcon
        className={clsx(
          "animate-spin transition-opacity",
          isSubmitting ? "opacity-50" : "hidden",
          fullWidthSubmit && "absolute top-8 right-2.5 text-white",
        )}
      />
    </footer>
  );
}
