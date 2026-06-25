import { useTranslate } from "src/hooks/use-translate";
import MenuAction, { DisabledMenuAction } from "src/components/menu-action";
import {
  FileTextIcon,
  UndoIcon,
  RedoIcon,
  SettingsIcon,
  SaveIcon,
  RunSimulationIcon,
  ImportCustomerPointsIcon,
  PanelBottomIcon,
  PanelBottomActiveIcon,
  PanelLeftIcon,
  PanelLeftActiveIcon,
  PanelRightActiveIcon,
  PanelRightIcon,
  SearchIcon,
  TableIcon,
  HglProfileIcon,
  ZonesIcon,
} from "src/icons";
import { useAtomValue, useSetAtom } from "jotai";
import { splitsAtom } from "src/state/layout";
import { commandBarOpenAtom } from "src/state/command-bar";
import { opfsAvailableAtom } from "src/state/opfs";
import {
  canRedoDerivedAtom,
  canUndoDerivedAtom,
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { saveShortcut } from "src/commands/save-inp";
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
import { useAllocateCustomerPoints } from "src/commands/allocate-customer-points";
import { useOpenZonesImport } from "src/commands/open-zones-import";
import { useImportZonesDisabled } from "src/hooks/use-import-zones-disabled";
import { FileDropdown } from "./file-dropdown";
import { OperationalDataDropdown } from "./operational-data-dropdown";
import {
  TimestepSelector,
  useHasPlayableTimesteps,
} from "src/components/timestep-selector";
import { Mode, modeAtom } from "src/state/mode";
import { useShowDataTables } from "src/commands/show-data-tables";
import { useShowHglProfile } from "src/commands/show-hgl-profile";
import { useStartProfileSelection } from "src/commands/start-profile-selection";
import {
  toggleNetworkReviewShortcut,
  useToggleNetworkReview,
} from "src/commands/toggle-network-review";
import {
  toggleSidePanelShortcut,
  useToggleSidePanel,
} from "src/commands/toggle-side-panel";
import {
  toggleBottomPanelShortcut,
  useToggleBottomPanel,
} from "src/commands/toggle-bottom-panel";

export const Toolbar = ({
  readonly = false,
  customerAllocationDisabled = false,
}: {
  readonly?: boolean;
  customerAllocationDisabled?: boolean;
}) => {
  const translate = useTranslate();
  const saveProject = useSaveProject();
  const userTracking = useUserTracking();
  const runSimulation = useRunSimulation();
  const showSimulationSettings = useShowSimulationSettings();
  const showReport = useShowReport();
  const allocateCustomerPoints = useAllocateCustomerPoints();
  const showDataTables = useShowDataTables();
  const showHglProfile = useShowHglProfile();
  const startProfileSelection = useStartProfileSelection();
  const openZonesImport = useOpenZonesImport();
  const importZonesDisabled = useImportZonesDisabled();
  const isOPFSAvailable = useAtomValue(opfsAvailableAtom);
  const { mode: currentMode } = useAtomValue(modeAtom);

  const { undo, redo } = useHistoryControl();

  const simulation = useAtomValue(simulationDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const canUndo = useAtomValue(canUndoDerivedAtom);
  const canRedo = useAtomValue(canRedoDerivedAtom);
  const isMdOrLarger = useBreakpoint("md");
  const isSmOrLarger = useBreakpoint("sm");
  const hasPlayableTimesteps = useHasPlayableTimesteps();

  const fileActionsGroup = isSmOrLarger && (
    <>
      <MenuAction
        label={translate("save")}
        role="button"
        onClick={() => {
          void saveProject({ source: "toolbar" });
        }}
        readOnlyHotkey={saveShortcut}
      >
        <SaveIcon />
      </MenuAction>
      <MenuAction
        label={translate("allocateCustomerPoints.menuEntry")}
        role="button"
        onClick={() => allocateCustomerPoints()}
        disabled={customerAllocationDisabled}
      >
        <ImportCustomerPointsIcon />
      </MenuAction>
      <MenuAction
        label={translate("importZones.title")}
        role="button"
        onClick={() => {
          openZonesImport({ source: "toolbar" });
        }}
        disabled={importZonesDisabled}
      >
        <ZonesIcon />
      </MenuAction>
    </>
  );

  const undoRedoGroup = isMdOrLarger && (
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
        disabled={readonly || !canUndo}
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
        disabled={readonly || !canRedo}
      >
        <RedoIcon />
      </MenuAction>
      <Divider />
    </>
  );

  const simulationGroup = (
    <>
      {!isOPFSAvailable ? (
        <DisabledMenuAction
          label={translate("simulate")}
          reason={translate("simulateUnavailablePrivateBrowsing")}
        >
          <RunSimulationIcon className="stroke-yellow-600" />
        </DisabledMenuAction>
      ) : (
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
    </>
  );

  const operationalGroup = (
    <>
      <OperationalDataDropdown />
      <MenuAction
        label={translate("dataTables.title")}
        role="button"
        onClick={() => showDataTables({ source: "toolbar" })}
      >
        <TableIcon />
      </MenuAction>
      <MenuAction
        label={translate("hglProfile.toolbar")}
        role="button"
        selected={currentMode === Mode.HGL_PROFILE}
        onClick={() => {
          showHglProfile({ source: "toolbar" });
          startProfileSelection({ source: "toolbar" });
        }}
      >
        <HglProfileIcon />
      </MenuAction>
    </>
  );

  return (
    <div
      className="relative flex flex-row items-center justify-between overflow-x-auto sm:overflow-visible
  border-t dark:border-gray-900 px-2 h-12"
    >
      <div className="flex flex-row items-center justify-start">
        <FileDropdown />
        {fileActionsGroup}
        <Divider />
        {undoRedoGroup}
        {operationalGroup}
        <Divider />
        {simulationGroup}
        {hasPlayableTimesteps && (
          <>
            <Divider />
            <TimestepSelector variant="inline" />
          </>
        )}
      </div>
      <div className="flex flex-row items-center justify-end gap-2">
        <CommandBarButton />
        {isSmOrLarger && <LayoutActions />}
      </div>
    </div>
  );
};

const Divider = () => {
  return <div className="border-r-2 h-8 mx-1"></div>;
};

const CommandBarButton = () => {
  const translate = useTranslate();
  const setOpen = useSetAtom(commandBarOpenAtom);
  const userTracking = useUserTracking();

  return (
    <MenuAction
      label={translate("assetSearch.placeholder")}
      role="button"
      onClick={() => {
        userTracking.capture({
          name: "commandBar.opened",
          source: "toolbar",
        });
        setOpen(true);
      }}
      readOnlyHotkey="ctrl+k"
    >
      <SearchIcon />
    </MenuAction>
  );
};

const LayoutActions = () => {
  const translate = useTranslate();
  const splits = useAtomValue(splitsAtom);
  const toggleNetworkReview = useToggleNetworkReview();
  const toggleBottomPanel = useToggleBottomPanel();
  const toggleSidePanel = useToggleSidePanel();

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

      <MenuAction
        label={translate("toggleBottomPanel")}
        role="button"
        onClick={() => {
          toggleBottomPanel({ source: "toolbar" });
        }}
        readOnlyHotkey={toggleBottomPanelShortcut}
      >
        {bottomPanelIcon}
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
