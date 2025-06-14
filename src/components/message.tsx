import clsx from "clsx";

export const Message = ({
  variant,
  size = "auto",
  title,
  children,
}: {
  variant: "success" | "warning" | "error";
  title: string;
  size?: "auto" | "sm" | "md";
  children: React.ReactNode;
}) => {
  return (
    <div
      className={clsx(
        {
          "w-[420px]": size === "md",
          "w-[300px]": size === "sm",
          "w-auto": size === "auto",
        },
        "flex items-start p-3 border rounded-lg shadow-md",
        {
          "bg-green-50 border-green-200": variant === "success",
          "bg-orange-50 border-orange-200": variant === "warning",
          "bg-red-50 border-red-200": variant === "error",
        },
      )}
    >
      <div className="flex flex-col flex-grow space-y-1">
        <span
          className={clsx("text-sm font-semibold", {
            "text-green-700": variant === "success",
            "text-orange-700": variant === "warning",
            "text-red-700": variant === "error",
          })}
        >
          {title}
        </span>
        <div
          className={clsx("text-sm", {
            "text-green-600": variant === "success",
            "text-orange-600": variant === "warning",
            "text-red-600": variant === "error",
          })}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
