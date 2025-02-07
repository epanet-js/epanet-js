import {
  DownloadIcon,
  FilePlusIcon,
  VercelLogoIcon,
  DotFilledIcon,
  StretchHorizontallyIcon,
  CursorArrowIcon,
  LightningBoltIcon,
  AspectRatioIcon,
  KeyboardIcon,
  ResetIcon,
  LayersIcon,
} from "@radix-ui/react-icons";
import { useOpenInp } from "src/hooks/use-open-inp";
import { memo } from "react";
import { Button } from "./elements";
import { localizeKeybinding, translate } from "src/infra/i18n";
import { useSaveInp } from "src/hooks/use-save-inp";

export const NothingSelected = memo(function NothingSelected() {
  const openInp = useOpenInp();
  const saveInp = useSaveInp();
  return (
    <div className="px-3 pt-3 overflow-y-auto pb-4 text-gray-900 dark:text-gray-300 flex-auto placemark-scrollbar">
      <div className="text-sm font-semibold pb-2">
        {translate("onboardingSelectDrawing")}
      </div>
      <div
        className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        <div className="pt-1">
          <VercelLogoIcon />
        </div>
        <div>{translate("onboardingDrawReservoir")}</div>
        <div className="pt-1">
          <DotFilledIcon />
        </div>
        <div>{translate("onboardingDrawJunctions")}</div>
        <div className="pt-1">
          <StretchHorizontallyIcon />
        </div>
        <div>{translate("onboardingDrawPipe")}</div>
        <div className="pt-1">
          <CursorArrowIcon />
        </div>
        <div>{translate("onboardingSelectAsset")}</div>
      </div>
      <div className="pt-4 space-y-3">
        <div className="text-sm font-semibold pb-2">
          {translate("onboardingRunningModel")}
        </div>
      </div>
      <div
        className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        <div className="pt-1">
          <LightningBoltIcon />
        </div>
        <div>{translate("onboardingRunSimulation")}</div>
        <div className="pt-1">
          <AspectRatioIcon />
        </div>
        <div>{translate("onboardingAnalysis")}</div>
      </div>
      <div className="pt-4 space-y-3">
        <div className="text-sm font-semibold pb-2">
          {translate("onboardingOtherFeatures")}
        </div>
      </div>
      <div
        className="grid gap-x-2 gap-y-4 items-start p-2 text-sm"
        style={{
          gridTemplateColumns: "min-content 1fr",
        }}
      >
        <div className="pt-1">
          <KeyboardIcon />
        </div>
        <div>
          {translate(
            "onboardingShortcuts",
            localizeKeybinding("2"),
            localizeKeybinding("Shift+Enter"),
          )}
        </div>
        <div className="pt-1">
          <ResetIcon />
        </div>
        <div>
          {translate(
            "onboardingUndoRedo",
            localizeKeybinding("ctrl+z"),
            localizeKeybinding("ctrl+y"),
          )}
        </div>
        <div className="pt-1">
          <LayersIcon />
        </div>
        <div>{translate("onboardingBasemaps")}</div>
      </div>
      <div className="pt-4 space-y-3">
        <div className="text-sm font-semibold pb-2">
          {translate("onboardingFiles")}
        </div>
        <div className="flex items-center gap-x-2">
          <Button
            type="button"
            onClick={() => {
              openInp();
            }}
          >
            <FilePlusIcon />
            {translate("openProject")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              saveInp();
            }}
          >
            <DownloadIcon />
            {translate("save")}
          </Button>
        </div>
      </div>
    </div>
  );
});
