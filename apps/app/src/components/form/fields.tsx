import clsx from "clsx";
import { createContext, useContext, useState } from "react";
import * as C from "@radix-ui/react-collapsible";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ChevronDownIcon, ChevronRightIcon } from "src/icons";
import { FooterResizer, useBigScreen } from "src/components/resizer";
import { TContent, StyledTooltipArrow } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";

// null = outside any SectionList; 0 = at outermost level; >0 = extra accumulated indentation from nested SectionLists
export const IndentationContext = createContext<number | null>(null);

const PADDING_CLASS: Record<number, string> = {
  0: "p-0",
  1: "p-1",
  2: "p-2",
  3: "p-3",
  4: "p-4",
};
const GAP_CLASS: Record<number, string> = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
};
const PL_CLASS: Record<number, string> = {
  0: "pl-0",
  1: "pl-1",
  2: "pl-2",
  3: "pl-3",
  4: "pl-4",
  5: "pl-5",
  6: "pl-6",
};
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

export const BlockComparisonField = ({
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
            className="absolute top-0 bottom-0 w-1 bg-accent rounded-full"
            style={{ left: `-${leftOffset}px` }}
          />
        )}
        <SectionList>{children}</SectionList>
      </div>
    </ComparisonTooltip>
  );
};

export const FieldList = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex flex-col gap-y-1">{children}</div>;
};

export const InlineField = ({
  name,
  layout = "fluid-label",
  labelSize = "sm",
  align = "center",
  hasChanged = false,
  baseDisplayValue,
  children,
}: {
  name: string;
  layout?: "fixed-label" | "fluid-label" | "half-split" | "label-flex-none";
  labelSize?: "sm" | "md" | "lg";
  align?: "start" | "center";
  hasChanged?: boolean;
  baseDisplayValue?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const indentation = useContext(IndentationContext) ?? 0;
  const nestingDepth = useContext(NestedBlockContext);
  const baseLabelWidth =
    (labelSize === "sm" ? 90 : labelSize === "md" ? 140 : 180) -
    indentation * 4 -
    nestingDepth * 2;

  const labelStyle =
    layout === "fixed-label" || layout === "fluid-label"
      ? { flexBasis: baseLabelWidth }
      : undefined;
  const inputStyle = layout === "fluid-label" ? { flexBasis: 150 } : undefined;

  const labelClasses = clsx("text-size-base text-subtle min-w-0", {
    "grow shrink": layout === "fluid-label",
    "shrink-0": layout === "fixed-label",
    "wrap-break-word": layout === "fixed-label" && labelSize === "sm",
    "w-1/2": layout === "half-split",
    "flex-none": layout === "label-flex-none",
  });
  const inputWrapperClasses = clsx("min-w-0", {
    "grow shrink": layout === "fluid-label",
    "flex-1": layout === "fixed-label",
    "w-1/2": layout === "half-split",
    "w-3/4": layout === "label-flex-none",
  });
  const spacingClass = labelSize === "sm" ? "space-x-4" : "gap-1";

  return (
    <BlockComparisonField
      hasChanged={hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      <div
        className={clsx("flex", spacingClass, {
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
    </BlockComparisonField>
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
    <span className="text-size-base text-subtle">{name}</span>
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
          "flex items-center justify-between text-size-base font-semibold h-8",
          {
            "text-subtle": variant === "secondary",
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
          PADDING_CLASS[padding],
          GAP_CLASS[gap],
          PL_CLASS[indentation + padding],
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
        <div className="flex flex-col grow overflow-hidden">
          {header && <div className="sticky top-0 z-10 bg-base">{header}</div>}
          {content}
          {isStickyFooter && footer && (
            <div
              className={clsx(
                "z-10 bg-base flex flex-col relative border-y",
                isResizableFooter ? "shrink-0" : "sticky bottom-0",
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
                className={clsx(
                  "flex-1 min-h-0 flex flex-col",
                  PADDING_CLASS[padding],
                )}
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

export const CollapsibleSection = ({
  title,
  variant = "primary",
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
  action,
  hasChanged = false,
  separator = false,
  indicatorPosition = "left",
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
        <BlockComparisonField hasChanged={hasChanged}>
          <C.Trigger asChild>
            <div
              className={clsx(
                "flex gap-1 items-center h-8 cursor-pointer",
                "px-1 -mx-1 rounded-sm hover:bg-base-hover",
                {
                  "text-size-base font-semibold": variant === "primary",
                  "text-size-base font-semibold text-subtle":
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
              {showSeparator && <div className="flex-1 border-b ml-2" />}
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
        </BlockComparisonField>
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

export const NestedSection = ({
  children,
  className,
  indentation = 2,
}: {
  children: React.ReactNode;
  className?: string;
  indentation?: number;
}) => {
  const parentDepth = useContext(NestedBlockContext);
  return (
    <NestedBlockContext.Provider value={parentDepth + 1}>
      <SectionList
        indentation={indentation}
        overflow={false}
        gap={1}
        className={clsx(
          "bg-panel -mr-1 pr-1 border-l-2 border-gray-400 rounded-xs",
          className,
        )}
      >
        {children}
      </SectionList>
    </NestedBlockContext.Provider>
  );
};
