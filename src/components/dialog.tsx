import {
  Suspense,
  useCallback,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from "react";
import type { IconProps } from "@radix-ui/react-icons/dist/types";
import { useFormikContext } from "formik";
import clsx from "clsx";
import {
  Button,
  DefaultErrorBoundary,
  Loading,
  StyledDialogContent,
  StyledDialogOverlay,
} from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";

import * as Dialog from "@radix-ui/react-dialog";
import { useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { CloseIcon, RefreshIcon } from "src/icons";

type SlottableIcon =
  | React.FC<React.ComponentProps<"svg">>
  | ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

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
  return (
    <DialogContainer size="xs">
      <Loading />
    </DialogContainer>
  );
};

export const DialogContainer = ({
  size = "sm",
  height,
  fillMode = "full",
  children,
  disableOutsideClick = false,
}: {
  size?: "sm" | "xs" | "md" | "lg" | "xl" | "fullscreen";
  height?: "sm" | "md" | "lg" | "xl" | "fullscreen";
  fillMode?: "full" | "auto";
  children: React.ReactNode;
  disableOutsideClick?: boolean;
}) => {
  const { closeDialog } = useDialogState();

  return (
    <Dialog.Root
      open={!!children}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          closeDialog();
        }
      }}
    >
      {/** Weird as hell shit here. Without this trigger, radix will
      return focus to the body element, which will not receive events. */}
      <Dialog.Trigger className="hidden">
        <div className="hidden"></div>
      </Dialog.Trigger>
      <Dialog.Portal>
        <StyledDialogOverlay />
        <Suspense fallback={<Loading />}>
          {/**radix complains if no title, so at least having an empty one helps**/}
          <Dialog.Title></Dialog.Title>
          {/**radix complains if no description, so at least having an empty one helps**/}
          <Dialog.Description></Dialog.Description>
          <StyledDialogContent
            widthClasses=""
            onEscapeKeyDown={(e) => {
              closeDialog();
              e.preventDefault();
              e.stopPropagation();
            }}
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("[data-privacy-banner]")) {
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

export function DialogHeader({
  title,
  titleIcon: TitleIcon,
  children,
  variant = "default",
  badge,
}: {
  title?: string;
  titleIcon?: SlottableIcon;
  variant?: "default" | "danger" | "success" | "warning";
  children?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div
      className="flex items-center
        gap-x-2
        pb-4 text-base sm:text-lg
        text-black dark:text-white"
    >
      {children && children}
      {TitleIcon && (
        <TitleIcon
          className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${variant === "danger" ? "text-red-500" : variant === "success" ? "text-green-500" : variant === "warning" ? "text-yellow-500" : ""}`}
        />
      )}
      {title && (
        <div className="flex items-center gap-3 flex-auto min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 break-words sm:truncate">
            {title}
          </h1>
          {badge && badge}
        </div>
      )}
      <div className="self-start">
        <DialogCloseX />
      </div>
    </div>
  );
}

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

export const AckDialogAction = ({
  label,
  onAck,
  variant = "md",
}: {
  label?: string;
  onAck?: () => void;
  variant?: "md" | "xs";
}) => {
  const translate = useTranslate();
  return (
    <div
      className={clsx(
        variant === "xs" ? "pt-2" : "pt-6",
        "pb-1 relative",
        `pb-1 flex flex-col sm:items-center sm:flex-row-reverse space-y-2 sm:space-y-0 sm:gap-x-3`,
      )}
    >
      <Button autoFocus={true} type="button" onClick={onAck}>
        {label ? label : translate("cancel")}
      </Button>
    </div>
  );
};

export const DialogButtons = ({
  variant = "md",
  align = "right",
  children,
}: {
  variant?: "md" | "xs";
  align?: "left" | "right";
  children: React.ReactNode;
}) => {
  return (
    <div
      className={clsx(
        variant === "xs" ? "pt-2" : "pt-6",
        "pb-1 relative",
        align === "right"
          ? "pb-1 flex flex-col sm:items-center sm:flex-row-reverse sm:justify-start space-y-2 sm:space-y-0 sm:gap-x-3"
          : "pb-1 flex flex-col sm:items-center sm:flex-row space-y-2 sm:space-y-0 sm:gap-x-3",
      )}
    >
      {children}
    </div>
  );
};

export function SimpleDialogActions({
  action,
  onClose,
  fullWidthSubmit = false,
  autoFocusSubmit = true,
  secondary,
  variant = "md",
  isDisabled = false,
}: {
  action?: string;
  autoFocusSubmit?: boolean;
  onClose?: () => void;
  fullWidthSubmit?: boolean;
  secondary?: {
    action: string;
    onClick: () => void;
  };
  variant?: "md" | "xs";
  isDisabled?: boolean;
}) {
  const translate = useTranslate();
  const { isSubmitting } = useFormikContext();
  return (
    <div
      className={clsx(
        variant === "xs" ? "pt-2" : "pt-6",
        "relative",
        fullWidthSubmit
          ? "flex items-stretch justify-stretch"
          : `flex flex-col sm:items-center sm:flex-row-reverse space-y-2 sm:space-y-0 sm:gap-x-3`,
      )}
    >
      {action ? (
        <Button
          type="submit"
          disabled={isSubmitting || isDisabled}
          variant="primary"
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
      {onClose ? (
        <Button type="button" onClick={onClose}>
          {translate("cancel")}
        </Button>
      ) : null}
      <RefreshIcon
        className={clsx(
          "animate-spin transition-opacity",
          isSubmitting ? "opacity-50" : "opacity-0",
          fullWidthSubmit && "absolute top-8 right-2.5 text-white",
        )}
      />
    </div>
  );
}

export const SimpleDialogButtons = ({
  children,
  fullWidthSubmit = false,
  variant = "md",
}: {
  children: ReactNode;
  fullWidthSubmit?: boolean;
  variant?: "md" | "xs";
}) => {
  return (
    <div
      className={clsx(
        variant === "xs" ? "pt-2" : "pt-6",
        "pb-1 relative",
        fullWidthSubmit
          ? "flex items-stretch justify-stretch"
          : `pb-1 flex flex-col sm:items-center sm:flex-row-reverse space-y-2 sm:space-y-0 sm:gap-x-3`,
      )}
    >
      {children}
    </div>
  );
};
