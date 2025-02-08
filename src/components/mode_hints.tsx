import { Cross1Icon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useBreakpoint } from "src/hooks/use_responsive";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import {
  dataAtom,
  hideHintsAtom,
  selectionAtom,
  simulationAtom,
} from "src/state/jotai";
import { Mode, modeAtom } from "src/state/mode";
import { translate } from "src/infra/i18n";
import { analysisAtom } from "src/state/analysis";

export const tipLike = `
    bg-white dark:bg-gray-900
    rounded-sm
    shadow-[0_2px_10px_2px_rgba(0,0,0,0.1)]
    ring-1 ring-gray-200 dark:ring-gray-700
    content-layout z-10`;

function ModeHint({
  hintId,
  children,
}: {
  hintId: string;
  children: React.ReactNode;
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
      <div>{children}</div>

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

export function ModeHints() {
  const mode = useAtomValue(modeAtom);
  const { hydraulicModel } = useAtomValue(dataAtom);
  const simulation = useAtomValue(simulationAtom);
  const selection = useAtomValue(selectionAtom);
  const analysis = useAtomValue(analysisAtom);
  const show = useBreakpoint("lg");

  if (!show) {
    return null;
  }

  switch (mode.mode) {
    case Mode.DRAW_JUNCTION: {
      return (
        <ModeHint hintId={"DRAW_JUNCTION"}>
          {translate("onboardingDrawJunctions")}
          <div className="text-gray-500 text-sm">
            {translate("onboardingAutomaticElevations")}
          </div>
        </ModeHint>
      );
    }
    case Mode.NONE: {
      if (selection.type === "none") {
        if (hydraulicModel.assets.size === 0) {
          return (
            <ModeHint hintId={"EMPTY_STATE"}>
              <div className="flex flex-col gap-y-2">
                {translate("onboardingSelectDrawing")}
              </div>
            </ModeHint>
          );
        } else {
          if (simulation.status === "idle") {
            return (
              <ModeHint hintId={"RUN_SIMULATION"}>
                {translate("onboardingRunSimulation")}
              </ModeHint>
            );
          } else {
            if (
              simulation.status === "success" &&
              analysis.links.type === "none" &&
              analysis.nodes.type === "none"
            ) {
              return (
                <ModeHint hintId={"ADD_ANALYSIS"}>
                  {translate("onboardingAnalysis")}
                </ModeHint>
              );
            }
          }
        }
      }
      if (selection.type === "single") {
        const asset = hydraulicModel.assets.get(selection.id);
        if (asset && asset.isNode) {
          return (
            <ModeHint hintId={"DRAG_NODE"}>
              <div>{translate("onboardingMoveNode")}</div>
              <div className="text-gray-500 text-sm">
                {translate("onboardingAutomaticCalculations")}
              </div>
            </ModeHint>
          );
        }
      }
      break;
    }
    case Mode.DRAW_PIPE: {
      return (
        <ModeHint hintId={"DRAW_PIPE"}>
          {translate("onboardingDrawPipe")}
        </ModeHint>
      );
    }
    case Mode.DRAW_RESERVOIR: {
      return (
        <ModeHint hintId={"DRAW_RESERVOIR"}>
          {translate("onboardingDrawReservoir")}
        </ModeHint>
      );
    }
  }

  return null;
}
