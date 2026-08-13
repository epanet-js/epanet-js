const sizes = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-[3px]",
};

export type RingSpinnerSize = keyof typeof sizes;

export const RingSpinner = ({
  size = "sm",
  className,
}: {
  size?: RingSpinnerSize;
  className?: string;
}) => (
  <div
    className={`${sizes[size]} border-accent border-t-transparent rounded-full animate-spin ${className ?? ""}`}
    aria-label="loading"
    role="status"
  />
);
