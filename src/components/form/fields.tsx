import clsx from "clsx";
import { createContext, useContext, useState } from "react";
import * as C from "@radix-ui/react-collapsible";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ChevronDownIcon, ChevronRightIcon } from "src/icons";
import { FooterResizer, useBigScreen } from "src/components/resizer";
import { TContent, StyledTooltipArrow } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

// null = outside any SectionList; 0 = at outermost level; >0 = extra accumulated indentation from nested SectionLists
export const IndentationContext = createContext<number | null>(null);
// Counts NestedSection layers — used to account for border-l-2 (2px per layer) in stripe/label positioning
export const NestedBlockContext = createContext(0);

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
  const isNested = useContext(NestedBlockContext) > 0;

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
  const isNested = useContext(NestedBlockContext) > 0;
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

export const Section = ({
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
    <div className="flex flex-col gap-1">
      <div
        className={clsx(
          "flex items-center justify-between text-sm font-semibold h-8",
          {
            "text-gray-500": variant === "secondary",
          },
        )}
      >
        {title}
        {button && button}
      </div>
      <SectionList>{children}</SectionList>
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
  gap = 1,
  padding = 0,
  overflow = false,
  className,
  indentation = 0,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  isStickyFooter?: boolean;
  stickyFooterHeight?: number;
  onStickyFooterHeightChange?: (height: number) => void;
  children: React.ReactNode;
  gap?: number;
  padding?: number;
  indentation?: number;
  overflow?: boolean;
  className?: string;
}) => {
  const parentIndentation = useContext(IndentationContext);
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
        className={clsx(
          "flex flex-col",
          `p-${padding}`,
          `gap-${gap}`,
          `pl-${indentation + padding}`,
          className,
        )}
      >
        {children}
        {!isStickyFooter && footer}
      </div>
    </div>
  );

  const wrapped = (
    <IndentationContext.Provider
      value={(parentIndentation ?? 0) + indentation + padding}
    >
      {header || footer ? (
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
                className={clsx("flex-1 min-h-0 flex flex-col", `p-${padding}`)}
              >
                {footer}
              </div>
            </div>
          )}
        </div>
      ) : (
        content
      )}
    </IndentationContext.Provider>
  );

  return wrapped;
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
  title: React.ReactNode;
  variant?: "primary" | "secondary";
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
            </C.Trigger>
          </div>
        </BlockComparisonFieldLegacy>
        <C.Content className="flex flex-col gap-1">{children}</C.Content>
      </div>
    </C.Root>
  );
};

export const NestedSectionLegacy = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const parentDepth = useContext(NestedBlockContext);
  const useExtraMargin = useFeatureFlag("FLAG_UI_COLLAPSIBLE");
  return (
    <NestedBlockContext.Provider value={parentDepth + 1}>
      <div
        className={clsx(
          "bg-gray-50 px-2 py-1 mt-1 -mr-2 border-l-2 border-gray-400 rounded-sm flex flex-col gap-1",
          useExtraMargin && "ml-2",
          className,
        )}
      >
        {children}
      </div>
    </NestedBlockContext.Provider>
  );
};

const NestedSectionWithNesting = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const parentDepth = useContext(NestedBlockContext);
  return (
    <NestedBlockContext.Provider value={parentDepth + 1}>
      <SectionList
        indentation={2}
        overflow={false}
        gap={1}
        className={clsx(
          "bg-gray-50 -mr-1 pr-1 border-l-2 border-gray-400 rounded-sm",
          className,
        )}
      >
        {children}
      </SectionList>
    </NestedBlockContext.Provider>
  );
};

export const NestedSection = (props: {
  children: React.ReactNode;
  className?: string;
}) => {
  const useNesting = useFeatureFlag("FLAG_UI_COLLAPSIBLE");
  return useNesting ? (
    <NestedSectionWithNesting {...props} />
  ) : (
    <NestedSectionLegacy {...props} />
  );
};

const BlockComparisonFieldWithNesting = ({
  hasChanged,
  baseDisplayValue,
  children,
}: {
  hasChanged: boolean;
  baseDisplayValue?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const indentation = useContext(IndentationContext) ?? 0;
  const nestingDepth = useContext(NestedBlockContext);
  const leftOffset = indentation * 4 + nestingDepth * 2;

  return (
    <ComparisonTooltip
      hasChanged={hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <div className="relative">
        {hasChanged && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-purple-500 rounded-full"
            style={{ left: `-${leftOffset}px` }}
          />
        )}
        <SectionList>{children}</SectionList>
      </div>
    </ComparisonTooltip>
  );
};

export const BlockComparisonField = (props: {
  hasChanged: boolean;
  baseDisplayValue?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const useNesting = useFeatureFlag("FLAG_UI_COLLAPSIBLE");
  return useNesting ? (
    <BlockComparisonFieldWithNesting {...props} />
  ) : (
    <BlockComparisonFieldLegacy {...props} />
  );
};

const InlineFieldWithNesting = ({
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
  const indentation = useContext(IndentationContext) ?? 0;
  const nestingDepth = useContext(NestedBlockContext);
  const baseLabelWidth =
    (labelSize === "sm" ? 90 : 140) - indentation * 4 - nestingDepth * 2;
  const labelStyle =
    layout !== "fixed-label" ? undefined : { flexBasis: baseLabelWidth };

  const inputStyle =
    layout === "fixed-label" && labelSize === "md"
      ? { flexBasis: 150 }
      : undefined;

  const labelClasses = clsx("text-sm text-gray-500 min-w-0", {
    "grow shrink": layout === "fixed-label",
    "w-1/2": layout === "half-split",
    "flex-none": layout === "label-flex-none",
  });
  const inputWrapperClasses = clsx("min-w-0", {
    "grow shrink": layout === "fixed-label",
    "w-1/2": layout === "half-split",
    "w-3/4": layout === "label-flex-none",
  });
  const spacingClass = labelSize === "md" ? "gap-1" : "space-x-4";

  return (
    <BlockComparisonFieldWithNesting
      hasChanged={hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <div
        className={clsx("flex items-center", spacingClass, {
          "items-start": align === "start",
          "items-center": align === "center",
        })}
      >
        <label
          className={labelClasses}
          style={labelStyle}
          aria-label={`label: ${name}`}
        >
          {name}
        </label>
        <div className={inputWrapperClasses} style={inputStyle}>
          {children}
        </div>
      </div>
    </BlockComparisonFieldWithNesting>
  );
};

export const InlineField = (props: {
  name: string;
  layout?: "fixed-label" | "half-split" | "label-flex-none";
  labelSize?: "sm" | "md";
  align?: "start" | "center";
  hasChanged?: boolean;
  baseDisplayValue?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const useNesting = useFeatureFlag("FLAG_UI_COLLAPSIBLE");
  return useNesting ? (
    <InlineFieldWithNesting {...props} />
  ) : (
    <InlineFieldLegacy {...props} />
  );
};

const CollapsibleSectionWithNesting = ({
  title,
  variant = "primary",
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
  action,
  hasChanged = false,
  separator = true,
  indicatorPosition = "right",
  autoIndent = true,
}: {
  title: React.ReactNode;
  variant?: "primary" | "secondary" | "subtle";
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hasChanged?: boolean;
  separator?: boolean;
  indicatorPosition?: "left" | "right";
  autoIndent?: boolean;
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const handleOpenChange = isControlled ? onOpenChange! : setUncontrolledOpen;

  const showSeparator = action ? true : separator;

  return (
    <C.Root open={open} onOpenChange={handleOpenChange}>
      <div className="flex flex-col">
        <BlockComparisonFieldWithNesting hasChanged={hasChanged}>
          <C.Trigger asChild>
            <div
              className={clsx(
                "flex gap-1 items-center h-8 cursor-pointer",
                "px-1 -mx-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800",
                {
                  "text-sm font-semibold": variant === "primary",
                  "text-sm font-semibold text-gray-500":
                    variant === "secondary",
                },
                className,
              )}
              role="button"
              tabIndex={0}
            >
              {indicatorPosition === "left" ? (
                open ? (
                  <ChevronDownIcon />
                ) : (
                  <ChevronRightIcon />
                )
              ) : null}

              <span>{title}</span>
              {showSeparator && (
                <div className="flex-1 border-b border-gray-200 ml-2" />
              )}
              {!showSeparator && <div className="flex-1" />}
              {action && <div className="h-8 w-8 -my-1">{action}</div>}
              {indicatorPosition === "right" ? (
                open ? (
                  <ChevronDownIcon />
                ) : (
                  <ChevronRightIcon />
                )
              ) : null}
            </div>
          </C.Trigger>
        </BlockComparisonFieldWithNesting>
        <C.Content className="pt-1">
          <SectionList
            indentation={autoIndent && indicatorPosition === "left" ? 5 : 0}
            overflow={false}
          >
            {children}
          </SectionList>
        </C.Content>
      </div>
    </C.Root>
  );
};

export const CollapsibleSection = (props: {
  title: React.ReactNode;
  variant?: "primary" | "secondary";
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hasChanged?: boolean;
  separator?: boolean;
  indicatorPosition?: "left" | "right";
  autoIndent?: boolean;
  titleClassName?: string;
}) => {
  const useNesting = useFeatureFlag("FLAG_UI_COLLAPSIBLE");
  return useNesting ? (
    <CollapsibleSectionWithNesting {...props} />
  ) : (
    <CollapsibleSectionLegacy {...props} />
  );
};
