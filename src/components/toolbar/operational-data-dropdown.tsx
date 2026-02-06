import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  AdvancedSettingsIcon,
  ChevronDownIcon,
  ControlsIcon,
  PatternsIcon,
  PumpCurvesIcon,
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
import { useShowPumpCurves } from "src/commands/show-pump-curves";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

const FLAG_PUMP_CURVES = "FLAG_PUMP_CURVES";

export const OperationalDataDropdown = () => {
  const translate = useTranslate();
  const showControls = useShowControls();
  const showCurvesAndPatterns = useShowCurvesAndPatterns();
  const showPumpCurves = useShowPumpCurves();
  const isPumpCurvesEnabled = useFeatureFlag(FLAG_PUMP_CURVES);

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

              {isPumpCurvesEnabled && (
                <StyledItem
                  onSelect={() => showPumpCurves({ source: "toolbar" })}
                >
                  <PumpCurvesIcon />
                  {translate("pumpLibrary")}
                </StyledItem>
              )}

              <StyledItem onSelect={() => showControls({ source: "toolbar" })}>
                <ControlsIcon />
                {translate("controls.title")}
              </StyledItem>
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
      <TContent side="bottom">
        <StyledTooltipArrow />
        {translate("operationalData")}
      </TContent>
    </Tooltip.Root>
  );
};
