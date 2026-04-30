import { CloseIcon, InfoIcon } from "src/icons";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import clsx from "clsx";
import { useAtom, useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { ephemeralStateAtom } from "src/state/drawing";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { hideHintsAtom } from "src/state/user-settings";
import { Mode, modeAtom } from "src/state/mode";
import { profileViewAtom } from "src/state/profile-view";
import { localizeKeybinding } from "src/infra/i18n";
import { useTranslate } from "src/hooks/use-translate";
import { symbologyAtom } from "src/state/map-symbology";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { PropsWithChildren } from "react";

export const tipLike = `
    bg-white dark:bg-gray-900
    rounded-sm
    shadow-[0_2px_10px_2px_rgba(0,0,0,0.1)]
    ring-1 ring-gray-200 dark:ring-gray-700
    content-layout z-10`;

function HintWrapper({
  hintId,
  children,
}: PropsWithChildren<{
  hintId: string;
}>) {
  const [hideHints, setHideHints] = useAtom(hideHintsAtom);

  if (hideHints.includes(hintId)) {
    return null;
  }

  return (
    <div
      className={clsx(
        "absolute max-w-[600px] top-2 left-3 text-sm flex gap-x-2  dark:text-white rounded-md",
        "p-2 items-start",
        tipLike,
      )}
    >
      <div className="my-0.5">
        <InfoIcon />
      </div>
      {children}
      <button
        onClick={() => {
          setHideHints((hints) => {
            return hints.concat(hintId);
          });
        }}
      >
        <div className="my-0.5">
          <CloseIcon />
        </div>
      </button>
    </div>
  );
}

function Hint({
  hintId,
  text,
  secondaryText,
}: {
  hintId: string;
  text: string;
  secondaryText?: string;
}) {
  return (
    <HintWrapper hintId={hintId}>
      {!!secondaryText && (
        <div>
          <div>{text}</div>
          <div className="text-gray-500 text-sm">{secondaryText}</div>
        </div>
      )}
      {!secondaryText && <div>{text}</div>}
    </HintWrapper>
  );
}

export function Hints() {
  const translate = useTranslate();
  const mode = useAtomValue(modeAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationDerivedAtom);
  const selection = useAtomValue(selectionAtom);
  const dialogState = useAtomValue(dialogAtom);
  const symbology = useAtomValue(symbologyAtom);
  const ephemeralState = useAtomValue(ephemeralStateAtom);
  const profileView = useAtomValue(profileViewAtom);
  const show = useBreakpoint("lg");
  const isEditionBlocked = useIsEditionBlocked();

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
      if (selection.type === "single" && !isEditionBlocked) {
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
      if (selection.type === "singleCustomerPoint" && !isEditionBlocked) {
        return (
          <Hint
            hintId={"DRAG_CUSTOMER_POINT"}
            text={translate("onboardingMoveCustomerPoint")}
          />
        );
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
    case Mode.REDRAW_LINK: {
      return (
        <Hint hintId="REDRAW_LINK" text={translate("onboardingRedrawLink")} />
      );
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
    case Mode.CONNECT_CUSTOMER_POINTS: {
      return (
        <Hint
          hintId={"CONNECT_CUSTOMER_POINTS"}
          text={translate("onboardingConnectCustomerPoints")}
          secondaryText={translate(
            "onboardingShiftConnectCustomerPoints",
            localizeKeybinding("shift"),
          )}
        />
      );
    }
    case Mode.SELECT_RECTANGULAR: {
      if (ephemeralState.type === "areaSelect" && ephemeralState.isDrawing) {
        return (
          <Hint
            hintId={"END_SELECTION_RECTANGULAR"}
            text={translate("areaSelection.drawingRectangleEndHint")}
            secondaryText={translate(
              "areaSelection.operationHint",
              localizeKeybinding("shift"),
              localizeKeybinding("alt"),
            )}
          />
        );
      }
      return (
        <Hint
          hintId={"START_SELECTION_RECTANGULAR"}
          text={translate("areaSelection.drawingStartHint")}
          secondaryText={translate(
            "areaSelection.operationHint",
            localizeKeybinding("shift"),
            localizeKeybinding("alt"),
          )}
        />
      );

      if (ephemeralState.type !== "areaSelect") {
        return (
          <Hint
            hintId={"START_SELECTION_RECTANGULAR"}
            text={translate("areaSelection.drawingStartHint")}
            secondaryText={translate(
              "areaSelection.operationHint",
              localizeKeybinding("shift"),
              localizeKeybinding("alt"),
            )}
          />
        );
      }
      break;
    }
    case Mode.SELECT_POLYGONAL: {
      if (ephemeralState.type === "areaSelect" && ephemeralState.isDrawing) {
        return (
          <Hint
            hintId={"END_SELECTION_POLYGONAL"}
            text={translate("areaSelection.drawingPolygonEndHint")}
            secondaryText={translate(
              "areaSelection.operationHint",
              localizeKeybinding("shift"),
              localizeKeybinding("alt"),
            )}
          />
        );
      }
      return (
        <Hint
          hintId={"START_SELECTION_POLYGONAL"}
          text={translate("areaSelection.drawingStartHint")}
          secondaryText={translate(
            "areaSelection.operationHint",
            localizeKeybinding("shift"),
            localizeKeybinding("alt"),
          )}
        />
      );
    }
    case Mode.SELECT_FREEHAND: {
      if (ephemeralState.type === "areaSelect" && ephemeralState.isDrawing) {
        return (
          <Hint
            hintId={"END_SELECTION_FREEHAND"}
            text={translate("areaSelection.drawingFreehandEndHint")}
            secondaryText={translate(
              "areaSelection.operationHint",
              localizeKeybinding("shift"),
              localizeKeybinding("alt"),
            )}
          />
        );
      }
      return (
        <Hint
          hintId={"START_SELECTION_FREEHAND"}
          text={translate("areaSelection.drawingStartHint")}
          secondaryText={translate(
            "areaSelection.operationHint",
            localizeKeybinding("shift"),
            localizeKeybinding("alt"),
          )}
        />
      );
    }
    case Mode.BOUNDARY_TRACE_SELECT: {
      return (
        <Hint
          hintId={"TRACE_BOUNDARY"}
          text={translate("traceSelection.boundaryHint")}
          secondaryText={translate("traceSelection.boundarySecondaryHint")}
        />
      );
    }
    case Mode.UPSTREAM_TRACE_SELECT: {
      return (
        <Hint
          hintId={"TRACE_UPSTREAM"}
          text={translate("traceSelection.upstreamHint")}
        />
      );
    }
    case Mode.DOWNSTREAM_TRACE_SELECT: {
      return (
        <Hint
          hintId={"TRACE_DOWNSTREAM"}
          text={translate("traceSelection.downstreamHint")}
        />
      );
    }
    case Mode.PROFILE_VIEW: {
      if (profileView.phase === "selectingStart") {
        return (
          <Hint
            hintId={"PROFILE_VIEW_SELECT_START"}
            text={translate("profileView.selectStart")}
          />
        );
      }
      if (profileView.phase === "selectingEnd") {
        return (
          <Hint
            hintId={"PROFILE_VIEW_SELECT_END"}
            text={translate("profileView.selectEnd")}
          />
        );
      }
      break;
    }
    default:
      return null;
  }

  return null;
}
