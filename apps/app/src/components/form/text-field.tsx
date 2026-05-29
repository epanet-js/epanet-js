import clsx from "clsx";

export const TextField = ({
  children,
  padding = "md",
  className,
}: {
  children: React.ReactNode;
  padding?: "sm" | "md";
  className?: string;
}) => (
  <span
    className={clsx(
      "block w-full text-size-base border border-transparent tabular-nums",
      !className && "text-default",
      {
        "p-1": padding === "sm",
        "p-2": padding === "md",
      },
      className,
    )}
  >
    {children}
  </span>
);
