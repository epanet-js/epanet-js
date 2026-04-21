import { useTranslate } from "src/hooks/use-translate";
import MenuAction from "src/components/menu-action";
import {
  FileTextIcon,
  UndoIcon,
  RedoIcon,
  SettingsIcon,
  SaveIcon,
  SaveAllIcon,
  RunSimulationIcon,
  ImportCustomerPointsIcon,
  PanelBottomIcon,
  PanelBottomActiveIcon,
  PanelLeftIcon,
  PanelLeftActiveIcon,
  PanelRightActiveIcon,
  PanelRightIcon,
  SearchIcon,
} from "src/icons";
import Modes from "./modes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { splitsAtom } from "src/state/layout";
import { commandBarOpenAtom } from "src/state/command-bar";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import {
  saveAsShortcut,
  saveShortcut,
  useSaveInp,
} from "src/commands/save-inp";
import { useSaveProject } from "src/commands/save-project";
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
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { useImportCustomerPoints } from "src/commands/import-customer-points";
import { FileDropdown } from "./file-dropdown";
import { OperationalDataDropdown } from "./operational-data-dropdown";
import {
  toggleNetworkReviewShortcut,
  useToggleNetworkReview,
} from "src/commands/toggle-network-review";
import {
  toggleSidePanelShortcut,
  useToggleSidePanel,
} from "src/commands/toggle-side-panel";

export const Toolbar = ({
  readonly = false,
  customerAllocationDisabled = false,
}: {
  readonly?: boolean;
  customerAllocationDisabled?: boolean;
}) => {
  const translate = useTranslate();
  const saveInp = useSaveInp();
  const saveProject = useSaveProject();
  const userTracking = useUserTracking();
  const runSimulation = useRunSimulation();
  const showSimulationSettings = useShowSimulationSettings();
  const showReport = useShowReport();
  const importCustomerPoints = useImportCustomerPoints();
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const { undo, redo } = useHistoryControl();

  const simulation = useAtomValue(simulationDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const isMdOrLarger = useBreakpoint("md");
  const isSmOrLarger = useBreakpoint("sm");

  return (
    <div
      className="relative flex flex-row items-center justify-between overflow-x-auto sm:overflow-visible
          border-t border-gray-200 dark:border-gray-900 px-2 h-12"
    >
      <div className="flex flex-row items-center justify-start">
        <FileDropdown />
        {
          <>
            <MenuAction
              label={translate("save")}
              role="button"
              onClick={() => {
                if (isOurFileOn) {
                  void saveProject({ source: "toolbar" });
                } else {
                  void saveInp({ source: "toolbar" });
                }
              }}
              readOnlyHotkey={saveShortcut}
            >
              <SaveIcon />
            </MenuAction>
            <MenuAction
              label={translate("saveAs")}
              role="button"
              onClick={() => {
                if (isOurFileOn) {
                  void saveProject({ source: "toolbar", isSaveAs: true });
                } else {
                  void saveInp({ source: "toolbar", isSaveAs: true });
                }
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
          disabled={customerAllocationDisabled}
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
              disabled={readonly}
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
              disabled={readonly}
            >
              <RedoIcon />
            </MenuAction>
            <Divider />
          </>
        )}
        {isMdOrLarger && (
          <>
            <Modes disabled={readonly} />
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
              qualityType: simulationSettings.qualitySimulationType,
            });
            void runSimulation();
          }}
          expanded={true}
          readOnlyHotkey={runSimulationShortcut}
        >
          <RunSimulationIcon className="stroke-yellow-600" />
        </MenuAction>
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
        <OperationalDataDropdown />
      </div>
      <div className="flex flex-row items-center justify-end gap-2">
        <CommandBarButton />
        {isSmOrLarger && <LayoutActions />}
      </div>
    </div>
  );
};

const Divider = () => {
  return <div className="border-r-2 border-gray-100 h-8 mx-1"></div>;
};

const CommandBarButton = () => {
  const translate = useTranslate();
  const isAssetSearchOn = useFeatureFlag("FLAG_ASSET_SEARCH");
  const setOpen = useSetAtom(commandBarOpenAtom);

  if (!isAssetSearchOn) return null;

  return (
    <MenuAction
      label={translate("assetSearch.placeholder")}
      role="button"
      onClick={() => setOpen(true)}
      readOnlyHotkey="ctrl+k"
    >
      <SearchIcon />
    </MenuAction>
  );
};

const LayoutActions = () => {
  const translate = useTranslate();
  const [splits, setSplits] = useAtom(splitsAtom);
  const toggleNetworkReview = useToggleNetworkReview();
  const toggleSidePanel = useToggleSidePanel();
  const isBottomPanelOn = useFeatureFlag("FLAG_BOTTOM_PANEL");

  const leftPanelIcon = splits.leftOpen ? (
    <PanelLeftActiveIcon />
  ) : (
    <PanelLeftIcon />
  );
  const bottomPanelIcon = splits.bottomOpen ? (
    <PanelBottomActiveIcon />
  ) : (
    <PanelBottomIcon />
  );
  const rightPanelIcon = splits.rightOpen ? (
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
      {isBottomPanelOn && (
        <MenuAction
          label="Toggle bottom panel"
          role="button"
          onClick={() =>
            setSplits((s) => ({ ...s, bottomOpen: !s.bottomOpen }))
          }
        >
          {bottomPanelIcon}
        </MenuAction>
      )}
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
