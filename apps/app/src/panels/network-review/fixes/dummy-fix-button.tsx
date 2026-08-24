import { B3Variant, Button } from "src/components/elements";

// PLACEHOLDER for design screenshots only — no behaviour, no flag, no permission.
// Replace with the real FixButton (useIsEditionBlocked, paywall) before shipping.
export const DummyFixButton = ({
  label,
  icon,
  variant = "quiet",
}: {
  label: string;
  icon: React.ReactNode;
  variant?: B3Variant;
}) => (
  <Button
    variant={variant}
    size="xxs"
    aria-label={label}
    title={label}
    tabIndex={-1}
    className="h-6 w-6 self-center justify-center"
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.preventDefault()}
  >
    {icon}
  </Button>
);
