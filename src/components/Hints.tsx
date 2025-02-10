import { Cross1Icon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useBreakpoint } from "src/hooks/use_responsive";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import {
  dataAtom,
  ephemeralStateAtom,
  hideHintsAtom,
  selectionAtom,
  simulationAtom,
} from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";
import { localizeKeybinding, translate } from "src/infra/i18n";
import { analysisAtom } from "src/state/analysis";

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
  const mode = useAtomValue(modeAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const simulation = useAtomValue(simulationAtom);
  const selection = useAtomValue(selectionAtom);
  const analysis = useAtomValue(analysisAtom);
  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const show = useBreakpoint("lg");

  if (!show) {
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
              analysis.links.type === "none" &&
              analysis.nodes.type === "none"
            ) {
              return (
                <Hint
                  hintId={"ADD_ANALYSIS"}
                  text={translate("onboardingAnalysis")}
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
      if (ephemeralState.type === "drawPipe" && !!ephemeralState.startNode)
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
    case Mode.DRAW_RESERVOIR: {
      return (
        <Hint
          hintId={"DRAW_RESERVOIR"}
          text={translate("onboardingDrawReservoir")}
        />
      );
    }
  }

  return null;
}
