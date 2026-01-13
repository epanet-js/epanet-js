import { useTranslate } from "src/hooks/use-translate";
import MenuAction from "../menu-action";
import {
  ControlsIcon,
  FileTextIcon,
  UndoIcon,
  RedoIcon,
  SettingsIcon,
  SaveIcon,
  SaveAllIcon,
  RunSimulationIcon,
  ImportCustomerPointsIcon,
  PanelLeftIcon,
  PanelLeftActiveIcon,
  PanelRightActiveIcon,
  PanelRightIcon,
  TimerIcon,
} from "src/icons";
import Modes from "../modes";
import { useAtomValue } from "jotai";
import {
  simulationAtom,
  selectedFeaturesAtom,
  selectionAtom,
  splitsAtom,
} from "src/state/jotai";
import {
  saveAsShortcut,
  saveShortcut,
  useSaveInp,
} from "src/commands/save-inp";
import {
  runSimulationShortcut,
  useRunSimulation,
} from "src/commands/run-simulation";
import { useShowReport } from "src/commands/show-report";
import { useUserTracking } from "src/infra/user-tracking";
import { useHistoryControl } from "src/commands/history-control";
import {
  showSimulationSettingsShortcut,
  useShowSimulationSettings,
} from "src/commands/show-simulation-settings";
import {
  showControlsShortcut,
  useShowControls,
} from "src/commands/show-controls";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useImportCustomerPoints } from "src/commands/import-customer-points";
import { CreateNewDropdown } from "./create-new-dropdown";
import { ScenarioSwitcher } from "./scenario-switcher";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  toggleNetworkReviewShortcut,
  useToggleNetworkReview,
} from "src/commands/toggle-network-review";
import { ContextActions } from "../context-actions";
import {
  toggleSidePanelShortcut,
  useToggleSidePanel,
} from "src/commands/toggle-side-panel";
import { useRunSimulationPerformanceTest } from "src/commands/run-simulation-performance-test";
import { isDebugOn } from "src/infra/debug-mode";

export const Toolbar = () => {
  const translate = useTranslate();
  const saveInp = useSaveInp();
  const userTracking = useUserTracking();
  const runSimulation = useRunSimulation();
  const runPerformanceTest = useRunSimulationPerformanceTest();
  const showSimulationSettings = useShowSimulationSettings();
  const showControls = useShowControls();
  const showReport = useShowReport();
  const importCustomerPoints = useImportCustomerPoints();

  const { undo, redo } = useHistoryControl();

  const simulation = useAtomValue(simulationAtom);
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesAtom);
  const selection = useAtomValue(selectionAtom);

  const isMdOrLarger = useBreakpoint("md");
  const isSmOrLarger = useBreakpoint("sm");
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");

  const shouldHideContextActions =
    selectedWrappedFeatures.length === 1 &&
    selection.type !== "singleCustomerPoint";

  return (
    <div
      className="relative flex flex-row items-center justify-between overflow-x-auto sm:overflow-visible
          border-t border-gray-200 dark:border-gray-900 px-2 h-12"
    >
      <div className="flex flex-row items-center justify-start">
        <CreateNewDropdown />
        {isScenariosOn && (
          <>
            <ScenarioSwitcher />
            <Divider />
          </>
        )}
        {
          <>
            <MenuAction
              label={translate("save")}
              role="button"
              onClick={() => {
                void saveInp({ source: "toolbar" });
              }}
              readOnlyHotkey={saveShortcut}
            >
              <SaveIcon />
            </MenuAction>
            <MenuAction
              label={translate("saveAs")}
              role="button"
              onClick={() => {
                void saveInp({ source: "toolbar", isSaveAs: true });
              }}
              readOnlyHotkey={saveAsShortcut}
            >
              <SaveAllIcon />
            </MenuAction>
          </>
        }
        <MenuAction
          label={translate("importCustomerPoints.label")}
          role="button"
          onClick={() => {
            void importCustomerPoints({ source: "toolbar" });
          }}
        >
          <ImportCustomerPointsIcon />
        </MenuAction>
        <Divider />
        {isMdOrLarger && (
          <>
            <MenuAction
              label={translate("undo")}
              role="button"
              onClick={() => {
                userTracking.capture({
                  name: "operation.undone",
                  source: "toolbar",
                });

                void undo();
              }}
              readOnlyHotkey={"ctrl+z"}
            >
              <UndoIcon />
            </MenuAction>
            <MenuAction
              label={translate("redo")}
              role="button"
              onClick={() => {
                userTracking.capture({
                  name: "operation.redone",
                  source: "toolbar",
                });
                void redo();
              }}
              readOnlyHotkey={"ctrl+y"}
            >
              <RedoIcon />
            </MenuAction>
            <Divider />
          </>
        )}
        {isMdOrLarger && (
          <>
            <Modes replaceGeometryForId={null} />
            <Divider />
          </>
        )}
        <MenuAction
          label={translate("simulate")}
          role="button"
          onClick={() => {
            userTracking.capture({
              name: "simulation.executed",
              source: "toolbar",
            });
            void runSimulation();
          }}
          expanded={true}
          readOnlyHotkey={runSimulationShortcut}
        >
          <RunSimulationIcon className="stroke-yellow-600" />
        </MenuAction>
        {isDebugOn && (
          <MenuAction
            label="Performance Test"
            role="button"
            onClick={() => {
              void runPerformanceTest();
            }}
            disabled={simulation.status === "idle"}
          >
            <TimerIcon />
          </MenuAction>
        )}
        <MenuAction
          label={translate("simulationSettings.title")}
          role="button"
          onClick={() => showSimulationSettings({ source: "toolbar" })}
          readOnlyHotkey={showSimulationSettingsShortcut}
        >
          <SettingsIcon />
        </MenuAction>
        <MenuAction
          label={translate("viewReport")}
          role="button"
          onClick={() => {
            showReport({ source: "toolbar" });
          }}
          readOnlyHotkey={"alt+r"}
          disabled={simulation.status === "idle"}
        >
          <FileTextIcon />
        </MenuAction>
        <Divider />
        <MenuAction
          label={translate("controls.title")}
          role="button"
          onClick={() => showControls({ source: "toolbar" })}
          readOnlyHotkey={showControlsShortcut}
        >
          <ControlsIcon />
        </MenuAction>
        {isMdOrLarger && !shouldHideContextActions && (
          <>
            <ContextActions />
            <div className="flex-auto" />
          </>
        )}
      </div>
      <div className="flex flex-row items-center justify-end">
        {isSmOrLarger && <LayoutActions />}
      </div>
    </div>
  );
};

const Divider = () => {
  return <div className="border-r-2 border-gray-100 h-8 mx-1"></div>;
};

const LayoutActions = () => {
  const translate = useTranslate();
  const { leftOpen, rightOpen } = useAtomValue(splitsAtom);
  const toggleNetworkReview = useToggleNetworkReview();
  const toggleSidePanel = useToggleSidePanel();

  const leftPanelIcon = leftOpen ? <PanelLeftActiveIcon /> : <PanelLeftIcon />;

  const rightPanelIcon = rightOpen ? (
    <PanelRightActiveIcon />
  ) : (
    <PanelRightIcon />
  );

  return (
    <>
      <MenuAction
        label={translate("networkReview.toggle")}
        role="button"
        onClick={() => {
          toggleNetworkReview({ source: "toolbar" });
        }}
        readOnlyHotkey={toggleNetworkReviewShortcut}
      >
        {leftPanelIcon}
      </MenuAction>
      <MenuAction
        label={translate("toggleSidePanel")}
        role="button"
        onClick={() => {
          toggleSidePanel({ source: "toolbar" });
        }}
        readOnlyHotkey={toggleSidePanelShortcut}
      >
        {rightPanelIcon}
      </MenuAction>
    </>
  );
};
