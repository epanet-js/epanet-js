import clsx from "clsx";

export const FieldList = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex flex-col gap-y-1">{children}</div>;
};

export const InlineField = ({
  name,
  layout = "fixed-label",
  labelSize = "sm",
  align = "center",
  children,
}: {
  name: string;
  layout?: "fixed-label" | "half-split" | "label-flex-none";
  labelSize?: "sm" | "md";
  align?: "start" | "center";
  children: React.ReactNode;
}) => {
  const labelClasses = clsx("text-sm text-gray-500", {
    "max-w-[67px] w-full flex-shrink-0":
      layout === "fixed-label" && labelSize === "sm",
    "w-[120px] flex-shrink-0": layout === "fixed-label" && labelSize === "md",
    "w-1/2": layout === "half-split",
    "flex-none": layout === "label-flex-none",
  });
  const inputWrapperClasses = clsx({
    "flex-1": layout === "fixed-label",
    "w-1/2": layout === "half-split",
    "w-3/4": layout === "label-flex-none",
  });

  const spacingClass = labelSize === "md" ? "gap-1" : "space-x-4";

  return (
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
  children,
}: {
  title: string;
  button?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between text-sm font-semibold pb-2">
        {title}
        {button && button}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
};

export const SectionList = ({
  children,
  gap = 5,
  padding = 4,
}: {
  children: React.ReactNode;
  gap?: 1 | 2 | 3 | 4 | 5 | 6;
  padding?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}) => {
  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
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
      </div>
    </div>
  );
};
