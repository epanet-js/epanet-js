import * as Tooltip from "@radix-ui/react-tooltip";
import * as P from "@radix-ui/react-popover";
import { useState } from "react";
import {
  Button,
  TContent,
  StyledPopoverContent,
  StyledPopoverArrow,
  Keycap,
} from "./elements";
import { PipeIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useAtom, useAtomValue } from "jotai";
import {
  dataAtom,
  pipeDrawingDefaultsAtom,
  Mode,
  modeAtom,
} from "src/state/jotai";
import { QuantityRow } from "./panels/asset-panel/ui-components";
import { localizeKeybinding } from "src/infra/i18n";
import { useHotkeys } from "src/keyboard/hotkeys";
import { useDrawingMode } from "src/commands/set-drawing-mode";
import { useUserTracking } from "src/infra/user-tracking";

export const PipeDrawingButton = ({
  hotkey,
  selected,
}: {
  hotkey: string;
  selected: boolean;
}) => {
  const translate = useTranslate();
  const setDrawingMode = useDrawingMode();
  const userTracking = useUserTracking();
  const { mode: currentMode } = useAtomValue(modeAtom);
  const {
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);
  const [pipeDrawingDefaults, setPipeDrawingDefaults] = useAtom(
    pipeDrawingDefaultsAtom,
  );

  const [shouldShowPopover, setShouldShowPopover] = useState(false);
  const isOpen = shouldShowPopover && currentMode === Mode.DRAW_PIPE;

  useHotkeys(
    hotkey || "noop",
    (e) => {
      e.preventDefault();
      void setDrawingMode(Mode.DRAW_PIPE);
    },
    [setDrawingMode],
    "Pipe drawing mode",
  );

  const systemDefaults = quantities.defaults.pipe;
  const currentDiameter =
    pipeDrawingDefaults.diameter ?? systemDefaults.diameter ?? 0;
  const currentRoughness =
    pipeDrawingDefaults.roughness ?? systemDefaults.roughness ?? 0;

  const handleDiameterChange = (_name: string, newValue: number) => {
    setPipeDrawingDefaults((prev) => ({ ...prev, diameter: newValue }));
  };

  const handleRoughnessChange = (_name: string, newValue: number) => {
    setPipeDrawingDefaults((prev) => ({ ...prev, roughness: newValue }));
  };

  const handlePopoverMouseLeave = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setTimeout(() => {
      setShouldShowPopover(false);
    }, 0);
  };

  const handleOpenAutoFocus = (e: Event) => {
    e.preventDefault();

    const firstInput = (e.currentTarget as HTMLElement)?.querySelector("input");
    if (firstInput instanceof HTMLInputElement) {
      setTimeout(() => {
        firstInput.focus();
        firstInput.select();
      }, 0);
    }
  };

  return (
    <Tooltip.Root delayDuration={200}>
      <div className="h-10 w-8 group bn flex items-stretch py-1 focus:outline-none">
        <P.Root
          open={isOpen}
          onOpenChange={(open) => {
            setShouldShowPopover(open);
            if (open) {
              userTracking.capture({
                name: "drawingMode.enabled",
                source: "toolbar",
                type: "drawPipe",
              });
              void setDrawingMode(Mode.DRAW_PIPE);
            }
          }}
          modal={false}
        >
          <Tooltip.Trigger asChild>
            <P.Trigger asChild>
              <Button
                variant="quiet/mode"
                role="radio"
                aria-label={translate("drawPipe")}
                aria-checked={selected}
                aria-expanded={selected ? "true" : "false"}
              >
                <PipeIcon />
              </Button>
            </P.Trigger>
          </Tooltip.Trigger>
          <P.Portal>
            <StyledPopoverContent
              size="sm"
              side="bottom"
              align="start"
              onOpenAutoFocus={handleOpenAutoFocus}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onPointerLeave={handlePopoverMouseLeave}
            >
              <StyledPopoverArrow />
              <div className="flex flex-col gap-2">
                <QuantityRow
                  name="diameter"
                  value={currentDiameter}
                  positiveOnly={true}
                  isNullable={false}
                  unit={quantities.getUnit("diameter")}
                  decimals={quantities.getDecimals("diameter")}
                  onChange={handleDiameterChange}
                />
                <QuantityRow
                  name="roughness"
                  value={currentRoughness}
                  positiveOnly={true}
                  isNullable={false}
                  unit={quantities.getUnit("roughness")}
                  decimals={quantities.getDecimals("roughness")}
                  onChange={handleRoughnessChange}
                />
              </div>
            </StyledPopoverContent>
          </P.Portal>
        </P.Root>
      </div>
      <TContent side="bottom">
        <div className="flex gap-x-2 items-center">
          {translate("drawPipe")}
          <Keycap size="xs">{localizeKeybinding(hotkey)}</Keycap>
        </div>
      </TContent>
    </Tooltip.Root>
  );
};
