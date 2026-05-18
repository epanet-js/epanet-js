import * as DD from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  AnalysisToolsIcon,
  ChevronDownIcon,
  HglProfileIcon,
  TableIcon,
} from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import {
  Button,
  DDContent,
  StyledItem,
  TContent,
  StyledTooltipArrow,
} from "src/components/elements";
import { useShowDataTables } from "src/commands/show-data-tables";
import { useShowHglProfile } from "src/commands/show-hgl-profile";
import { useStartProfileSelection } from "src/commands/start-profile-selection";

export const AnalysisToolsDropdown = () => {
  const translate = useTranslate();
  const showDataTables = useShowDataTables();
  const showHglProfile = useShowHglProfile();
  const startProfileSelection = useStartProfileSelection();

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 w-12 group bn flex items-stretch py-1 focus:outline-none">
        <DD.Root>
          <Tooltip.Trigger asChild>
            <DD.Trigger asChild>
              <Button variant="quiet">
                <AnalysisToolsIcon />
                <ChevronDownIcon size="sm" />
              </Button>
            </DD.Trigger>
          </Tooltip.Trigger>
          <DD.Portal>
            <DDContent
              align="start"
              side="bottom"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <StyledItem
                onSelect={() => showDataTables({ source: "toolbar" })}
              >
                <TableIcon />
                {translate("dataTables.title")}
              </StyledItem>

              <StyledItem
                onSelect={() => {
                  showHglProfile({ source: "toolbar" });
                  startProfileSelection({ source: "toolbar" });
                }}
              >
                <HglProfileIcon />
                {translate("hglProfile.toolbar")}
              </StyledItem>
            </DDContent>
          </DD.Portal>
        </DD.Root>
      </div>
      <TContent side="bottom">
        <StyledTooltipArrow />
        {translate("analysisTools")}
      </TContent>
    </Tooltip.Root>
  );
};
