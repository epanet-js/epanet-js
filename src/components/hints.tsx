import { Cross1Icon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import {
  dataAtom,
  dialogAtom,
  ephemeralStateAtom,
  hideHintsAtom,
  selectionAtom,
  simulationAtom,
} from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";
import { localizeKeybinding } from "src/infra/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { symbologyAtom } from "src/state/symbology";

export const tipLike = `
    bg-white dark:bg-gray-900
    rounded-sm
    shadow-[0_2px_10px_2px_rgba(0,0,0,0.1)]
    ring-1 ring-gray-200 dark:ring-gray-700
    content-layout z-10`;

function Hint({
  hintId,
  text,
  secondaryText,
}: {
  hintId: string;
  text: string;
  secondaryText?: string;
}) {
  const [hideHints, setHideHints] = useAtom(hideHintsAtom);

  if (hideHints.includes(hintId)) {
    return null;
  }

  return (
    <div
      className={clsx(
        "absolute pl-2 pr-1 py-2 max-w-[600px] top-2 left-3 text-sm flex gap-x-2 items-start dark:text-white rounded-md ",
        tipLike,
      )}
    >
      <InfoCircledIcon className="shrink-0 w-5 h-5" />
      {!!secondaryText && (
        <div>
          <div>{text}</div>
          <div className="text-gray-500 text-sm">{secondaryText}</div>
        </div>
      )}
      {!secondaryText && <div>{text}</div>}

      <button
        className="px-1 py-1"
        onClick={() => {
          setHideHints((hints) => {
            return hints.concat(hintId);
          });
        }}
      >
        <Cross1Icon className="w-3 h-3 shrink-0" />
      </button>
    </div>
  );
}

export function Hints() {
  const translate = useTranslate();
  const mode = useAtomValue(modeAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const simulation = useAtomValue(simulationAtom);
  const selection = useAtomValue(selectionAtom);
  const dialogState = useAtomValue(dialogAtom);
  const symbology = useAtomValue(symbologyAtom);
  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const show = useBreakpoint("lg");

  if (!show || !!dialogState) {
    return null;
  }

  switch (mode.mode) {
    case Mode.DRAW_JUNCTION: {
      return (
        <Hint
          hintId={"DRAW_JUNCTION"}
          text={translate("onboardingDrawJunctions")}
          secondaryText={translate("onboardingAutomaticElevations")}
        />
      );
    }
    case Mode.NONE: {
      if (selection.type === "none") {
        if (hydraulicModel.assets.size === 0) {
          return (
            <Hint
              hintId={"EMPTY_STATE"}
              text={translate("onboardingSelectDrawing", ".")}
            />
          );
        } else {
          if (simulation.status === "idle") {
            return (
              <Hint
                hintId={"RUN_SIMULATION"}
                text={translate("onboardingRunSimulation")}
              />
            );
          } else {
            if (
              simulation.status === "success" &&
              !symbology.link.colorRule &&
              !symbology.node.colorRule
            ) {
              return (
                <Hint
                  hintId={"VISIT_MAP_TAB"}
                  text={translate("onboardingMap")}
                />
              );
            }
          }
        }
      }
      if (selection.type === "single") {
        const asset = hydraulicModel.assets.get(selection.id);
        if (asset && asset.isNode) {
          return (
            <Hint
              hintId={"DRAG_NODE"}
              text={translate("onboardingMoveNode")}
              secondaryText={translate("onboardingAutomaticUpdates")}
            />
          );
        }
      }
      break;
    }
    case Mode.DRAW_PIPE: {
      if (
        ephemeralState.type === "drawLink" &&
        ephemeralState.linkType === "pipe" &&
        !!ephemeralState.startNode
      )
        return (
          <Hint
            hintId="DRAW_PIPE"
            text={translate("onboardingDrawPipe")}
            secondaryText={translate(
              "onboardingCtrlPipe",
              localizeKeybinding("ctrl"),
            )}
          />
        );

      if (hydraulicModel.assets.size === 0) {
        return (
          <Hint
            hintId={"START_PIPE"}
            text={translate("onboardingStartPipeEmpty")}
          />
        );
      } else {
        return (
          <Hint hintId={"START_PIPE"} text={translate("onboardingStartPipe")} />
        );
      }
    }
    case Mode.DRAW_PUMP: {
      if (
        ephemeralState.type === "drawLink" &&
        ephemeralState.linkType === "pump" &&
        !!ephemeralState.startNode
      )
        return (
          <Hint
            hintId="DRAW_PUMP"
            text={translate("onboardingDrawPump")}
            secondaryText={translate(
              "onboardingCtrlPump",
              localizeKeybinding("ctrl"),
            )}
          />
        );

      if (hydraulicModel.assets.size === 0) {
        return (
          <Hint
            hintId={"START_PUMP"}
            text={translate("onboardingStartPumpEmpty")}
          />
        );
      } else {
        return (
          <Hint hintId={"START_PUMP"} text={translate("onboardingStartPump")} />
        );
      }
    }
    case Mode.DRAW_VALVE: {
      if (
        ephemeralState.type === "drawLink" &&
        ephemeralState.linkType === "valve" &&
        !!ephemeralState.startNode
      )
        return (
          <Hint
            hintId="DRAW_VALVE"
            text={translate("onboardingDrawValve")}
            secondaryText={translate(
              "onboardingCtrlValve",
              localizeKeybinding("ctrl"),
            )}
          />
        );

      if (hydraulicModel.assets.size === 0) {
        return (
          <Hint
            hintId={"START_VALVE"}
            text={translate("onboardingStartValveEmpty")}
          />
        );
      } else {
        return (
          <Hint
            hintId={"START_VALVE"}
            text={translate("onboardingStartValve")}
          />
        );
      }
    }
    case Mode.DRAW_RESERVOIR: {
      return (
        <Hint
          hintId={"DRAW_RESERVOIR"}
          text={translate("onboardingDrawReservoir")}
        />
      );
    }
    case Mode.DRAW_TANK: {
      return (
        <Hint hintId={"DRAW_TANK"} text={translate("onboardingDrawTank")} />
      );
    }
  }

  return null;
}
