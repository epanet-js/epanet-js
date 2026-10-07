import { Tooltip } from "@epanet-js/ui-kit";
import { B3Variant, Button } from "src/components/elements";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";

export const FixButton = ({
  label,
  icon,
  variant = "quiet",
  onFix,
}: {
  label: string;
  icon: React.ReactNode;
  variant?: B3Variant;
  onFix: () => void;
}) => {
  const isEditionBlocked = useIsEditionBlocked();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFix();
  };

  return (
    <Tooltip
      content={<span className="whitespace-nowrap">{label}</span>}
      delayDuration={700}
    >
      <Button
        variant={variant}
        size="xxs"
        aria-label={label}
        tabIndex={-1}
        disabled={isEditionBlocked}
        className="h-6 w-6 self-center justify-center"
        onClick={handleClick}
        onMouseDown={(e) => e.preventDefault()}
      >
        {icon}
      </Button>
    </Tooltip>
  );
};
