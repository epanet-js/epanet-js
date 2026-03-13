import clsx from "clsx";
import { createContext, useContext, useState } from "react";
import * as C from "@radix-ui/react-collapsible";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ChevronDownIcon, ChevronRightIcon } from "src/icons";
import { FooterResizer, useBigScreen } from "src/components/resizer";
import { TContent, StyledTooltipArrow } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const NestedSectionContext = createContext(false);

const ComparisonTooltip = ({
  hasChanged,
  baseDisplayValue,
  children,
}: {
  hasChanged: boolean;
  baseDisplayValue?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const translate = useTranslate();

  if (hasChanged && baseDisplayValue !== undefined) {
    return (
      <Tooltip.Root delayDuration={200}>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <TContent side="left" sideOffset={15}>
            <StyledTooltipArrow />
            {translate("scenarios.main")}: {baseDisplayValue}
          </TContent>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return children;
};

export const BlockComparisonFieldLegacy = ({
  hasChanged,
  baseDisplayValue,
  children,
}: {
  hasChanged: boolean;
  baseDisplayValue?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const isNested = useContext(NestedSectionContext);

  return (
    <ComparisonTooltip
      hasChanged={hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <div className="relative">
        {hasChanged && (
          <div
            className={clsx(
              "absolute top-0 bottom-0 w-1 bg-purple-500 rounded-full",
              isNested ? "-left-[26px]" : "-left-4",
            )}
          />
        )}
        {children}
      </div>
    </ComparisonTooltip>
  );
};

export const FieldList = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex flex-col gap-y-1">{children}</div>;
};

export const InlineFieldLegacy = ({
  name,
  layout = "fixed-label",
  labelSize = "sm",
  align = "center",
  hasChanged = false,
  baseDisplayValue,
  children,
}: {
  name: string;
  layout?: "fixed-label" | "half-split" | "label-flex-none";
  labelSize?: "sm" | "md";
  align?: "start" | "center";
  hasChanged?: boolean;
  baseDisplayValue?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const isNested = useContext(NestedSectionContext);
  const useExtraMargin = useFeatureFlag("FLAG_UI_COLLAPSIBLE");

  const labelClasses = clsx("text-sm text-gray-500", {
    "max-w-[57px] w-full flex-shrink-0":
      layout === "fixed-label" &&
      labelSize === "sm" &&
      isNested &&
      !useExtraMargin,
    "max-w-[49px] w-full flex-shrink-0":
      layout === "fixed-label" &&
      labelSize === "sm" &&
      isNested &&
      useExtraMargin,
    "max-w-[67px] w-full flex-shrink-0":
      layout === "fixed-label" && labelSize === "sm" && !isNested,
    "w-[110px] flex-shrink-0":
      layout === "fixed-label" &&
      labelSize === "md" &&
      isNested &&
      !useExtraMargin,
    "w-[102px] flex-shrink-0":
      layout === "fixed-label" &&
      labelSize === "md" &&
      isNested &&
      useExtraMargin,
    "w-[120px] flex-shrink-0":
      layout === "fixed-label" && labelSize === "md" && !isNested,
    "w-1/2": layout === "half-split",
    "flex-none": layout === "label-flex-none",
  });
  const inputWrapperClasses = clsx({
    "min-w-0 flex-1": layout === "fixed-label",
    "w-1/2": layout === "half-split",
    "w-3/4": layout === "label-flex-none",
  });

  const spacingClass = labelSize === "md" ? "gap-1" : "space-x-4";

  return (
    <BlockComparisonFieldLegacy
      hasChanged={hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <div
        className={clsx("flex", spacingClass, {
          "items-start": align === "start",
          "items-center": align === "center",
          "pl-2": useExtraMargin,
        })}
      >
        <label className={labelClasses} aria-label={`label: ${name}`}>
          {name}
        </label>
        <div className={inputWrapperClasses}>{children}</div>
      </div>
    </BlockComparisonFieldLegacy>
  );
};

export const VerticalField = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-y-2 w-full">
    <span className="text-sm text-gray-500">{name}</span>
    {children}
  </div>
);

export const SectionLegacy = ({
  title,
  button,
  variant = "primary",
  children,
}: {
  title: string;
  button?: React.ReactNode;
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col">
      <div
        className={clsx(
          "flex items-start justify-between text-sm font-semibold pb-2",
          {
            "text-gray-500": variant === "secondary",
          },
        )}
      >
        {title}
        {button && button}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
};

export const SectionList = ({
  header,
  footer,
  isStickyFooter = false,
  stickyFooterHeight,
  onStickyFooterHeightChange,
  children,
  gap = 5,
  padding = 4,
  overflow = true,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  isStickyFooter?: boolean;
  stickyFooterHeight?: number;
  onStickyFooterHeightChange?: (height: number) => void;
  children: React.ReactNode;
  gap?: 1 | 2 | 3 | 4 | 5 | 6;
  padding?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  overflow?: boolean;
}) => {
  const isBigScreen = useBigScreen();
  const isResizableFooter =
    isBigScreen &&
    isStickyFooter &&
    stickyFooterHeight !== undefined &&
    onStickyFooterHeightChange !== undefined;

  const content = (
    <div
      className={clsx(
        overflow
          ? "flex-auto overflow-y-auto placemark-scrollbar scroll-shadows"
          : "",
      )}
    >
      <div
        className={clsx("flex flex-col", {
          "gap-1": gap === 1,
          "gap-2": gap === 2,
          "gap-3": gap === 3,
          "gap-4": gap === 4,
          "gap-5": gap === 5,
          "gap-6": gap === 6,
          "p-0": padding === 0,
          "p-1": padding === 1,
          "p-2": padding === 2,
          "p-3": padding === 3,
          "p-4": padding === 4,
          "p-5": padding === 5,
          "p-6": padding === 6,
        })}
      >
        {children}
        {!isStickyFooter && footer}
      </div>
    </div>
  );

  if (header || footer) {
    return (
      <div className="flex flex-col flex-grow overflow-hidden">
        {header && (
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-950">
            {header}
          </div>
        )}
        {content}
        {isStickyFooter && footer && (
          <div
            className={clsx(
              "z-10 bg-white dark:bg-gray-950 flex flex-col relative border-y border-gray-200 dark:border-gray-800",
              isResizableFooter ? "flex-shrink-0" : "sticky bottom-0",
            )}
            style={
              isResizableFooter ? { height: stickyFooterHeight } : undefined
            }
          >
            {isResizableFooter && (
              <FooterResizer
                height={stickyFooterHeight}
                onHeightChange={onStickyFooterHeightChange}
              />
            )}
            <div
              className={clsx("flex-1 min-h-0 flex flex-col", {
                "p-0": padding === 0,
                "p-1": padding === 1,
                "p-2": padding === 2,
                "p-3": padding === 3,
                "p-4": padding === 4,
                "p-5": padding === 5,
                "p-6": padding === 6,
              })}
            >
              {footer}
            </div>
          </div>
        )}
      </div>
    );
  }

  return content;
};

export const CollapsibleSectionLegacy = ({
  title,
  variant = "primary",
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
  action,
  hasChanged = false,
}: {
  title: string;
  variant?: "primary" | "secondary" | "subtle";
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hasChanged?: boolean;
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const handleOpenChange = isControlled ? onOpenChange! : setUncontrolledOpen;

  return (
    <C.Root open={open} onOpenChange={handleOpenChange}>
      <div className={clsx("flex flex-col", className)}>
        <BlockComparisonFieldLegacy hasChanged={hasChanged}>
          <div className="flex items-center gap-1">
            <C.Trigger asChild>
              {variant === "subtle" ? (
                <button
                  className={clsx(
                    "flex-1 min-w-0 flex items-center gap-1 text-sm font-semibold cursor-pointer",
                    "-ml-2 pb-2",
                  )}
                >
                  {open ? (
                    <ChevronDownIcon size="sm" />
                  ) : (
                    <ChevronRightIcon size="sm" />
                  )}
                  <span className="truncate">{title}</span>
                </button>
              ) : (
                <div
                  className={clsx(
                    "flex-1 flex items-center text-sm font-semibold cursor-pointer hover:text-gray-700 dark:hover:text-gray-100",
                    "p-2 -mx-2 -mt-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                    {
                      "text-gray-500": variant === "secondary",
                      "mb-1": open,
                    },
                  )}
                  role="button"
                  tabIndex={0}
                >
                  <span>{title}</span>
                  <div className="flex-1 border-b border-gray-200 mx-3 mb-1" />
                  {action && <div className="h-8 w-8 -my-1">{action}</div>}
                  <div className="ml-1">
                    {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
                  </div>
                </div>
              )}
            </C.Trigger>
          </div>
        </BlockComparisonFieldLegacy>
        <C.Content className="flex flex-col gap-1">{children}</C.Content>
      </div>
    </C.Root>
  );
};
