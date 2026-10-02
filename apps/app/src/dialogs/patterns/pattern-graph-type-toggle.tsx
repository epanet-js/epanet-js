import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, TContent, StyledTooltipArrow } from "src/components/elements";
import { ChartColumnIcon, ChartLineIcon } from "src/icons";
import type { PatternGraphType } from "src/state/layout";

export function PatternGraphTypeToggle({
  graphType,
  onChange,
}: {
  graphType: PatternGraphType;
  onChange: (graphType: PatternGraphType) => void;
}) {
  const nextGraphType = graphType === "bar" ? "line" : "bar";
  const label =
    nextGraphType === "line" ? "Show as line chart" : "Show as bar chart";

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Button
          variant="default"
          size="xxs"
          className="h-8 w-8 justify-center"
          aria-label={label}
          onClick={() => onChange(nextGraphType)}
        >
          {nextGraphType === "line" ? <ChartLineIcon /> : <ChartColumnIcon />}
        </Button>
      </Tooltip.Trigger>
      <TContent side="bottom">
        <StyledTooltipArrow />
        <span className="whitespace-nowrap">{label}</span>
      </TContent>
    </Tooltip.Root>
  );
}
