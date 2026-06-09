export const RingSpinner = ({ className }: { className?: string }) => (
  <div
    className={`w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin ${className ?? ""}`}
    aria-label="loading"
    role="status"
  />
);
