import * as Tooltip from "@radix-ui/react-tooltip";
import {
  B3Variant,
  Button,
  TContent,
  StyledTooltipArrow,
} from "src/components/elements";
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
    <Tooltip.Root>
      <Tooltip.Trigger onClick={handleClick} asChild>
        <Button
          variant={variant}
          size="xxs"
          aria-label={label}
          tabIndex={-1}
          disabled={isEditionBlocked}
          className="h-6 w-6 self-center justify-center"
          onMouseDown={(e) => e.preventDefault()}
        >
          {icon}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <TContent side="bottom">
          <StyledTooltipArrow />
          <span className="whitespace-nowrap">{label}</span>
        </TContent>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};
