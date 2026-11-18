import * as Popover from "@radix-ui/react-popover";
import { useSelectorPortalContainer } from "@epanet-js/ui-kit";
import * as E from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { InfoIcon } from "src/icons";

export const FormatInfo = () => {
  const translate = useTranslate();
  const portalContainer = useSelectorPortalContainer();
  const label = translate("sensorData.import.format.title");

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="p-1 rounded-base text-subtle hover:text-default hover:bg-base-hover"
          aria-label={label}
        >
          <InfoIcon />
        </button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer}>
        <E.StyledPopoverContent
          size="md"
          side="bottom"
          align="start"
          sideOffset={4}
          aria-label={label}
        >
          <E.StyledPopoverArrow />
          <div className="flex flex-col gap-2 text-size-base text-default">
            <h3 className="font-semibold">{label}</h3>
            <p>{translate("sensorData.import.format.columns")}</p>
            <p>{translate("sensorData.import.format.readings")}</p>
          </div>
        </E.StyledPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
};
