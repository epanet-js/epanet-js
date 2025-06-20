import clsx from "clsx";

export const FieldList = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex flex-col gap-y-2">{children}</div>;
};

export const InlineField = ({
  name,
  layout = "fixed-label",
  align = "center",
  children,
}: {
  name: string;
  layout?: "fixed-label" | "half-split";
  align?: "start" | "center";
  children: React.ReactNode;
}) => {
  const labelClasses = clsx("text-sm text-gray-500", {
    "max-w-[67px] w-full flex-shrink-0": layout === "fixed-label",
    "w-1/2": layout === "half-split",
  });
  const inputWrapperClasses = clsx({
    "flex-1": layout === "fixed-label",
    "w-1/2": layout === "half-split",
  });

  return (
    <div
      className={clsx("flex space-x-4", {
        "items-start": align === "start",
        "items-center": align === "center",
      })}
    >
      <label className={labelClasses}>{name}</label>

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
