import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  AdvancedSettingsIcon,
  ChevronDownIcon,
  ControlsIconAlt,
  PatternsIcon,
} from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import {
  Button,
  DDContent,
  StyledItem,
  TContent,
  StyledTooltipArrow,
} from "../elements";
import { useShowControls } from "src/commands/show-controls";
import { useShowCurvesAndPatterns } from "src/commands/show-curves-and-patterns";

export const AdvancedSettingsDropdown = () => {
  const translate = useTranslate();
  const showControls = useShowControls();
  const showCurvesAndPatterns = useShowCurvesAndPatterns();

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 w-12 group bn flex items-stretch py-1 focus:outline-none">
        <DD.Root>
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild>
              <Button variant="quiet">
                <AdvancedSettingsIcon />
                <ChevronDownIcon size="sm" />
              </Button>
            </DD.Trigger>
          </Tooltip.Trigger>
          <DD.Portal>
            <DDContent align="start" side="bottom">
              <StyledItem
                onSelect={() => showCurvesAndPatterns({ source: "toolbar" })}
              >
                <PatternsIcon />
                {translate("curvesAndPatterns")}
              </StyledItem>

              <StyledItem onSelect={() => showControls({ source: "toolbar" })}>
                <ControlsIconAlt />
                {translate("controls.title")}
              </StyledItem>
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
      <TContent side="bottom">
        <StyledTooltipArrow />
        {translate("advancedSettings")}
      </TContent>
    </Tooltip.Root>
  );
};
