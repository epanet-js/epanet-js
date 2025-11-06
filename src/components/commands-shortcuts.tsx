import { useHotkeys } from "src/keyboard/hotkeys";
import { showReportShorcut, useShowReport } from "src/commands/show-report";
import { useUserTracking } from "src/infra/user-tracking";
import {
  runSimulationShortcut,
  useRunSimulation,
} from "src/commands/run-simulation";
import {
  createNewShortcut,
  useNewProject,
} from "src/commands/create-new-project";
import {
  saveAsShortcut,
  saveShortcut,
  useSaveInp,
} from "src/commands/save-inp";
import {
  redoShortcut,
  undoShortcut,
  useHistoryControl,
} from "src/commands/history-control";
import {
  drawingModeShorcuts,
  useDrawingMode,
} from "src/commands/set-drawing-mode";
import { MODE_INFO, Mode } from "src/state/mode";
import {
  showSortcutsShortcut,
  useShowShortcuts,
} from "src/commands/show-shortcuts";
import {
  deleteSelectedShortcuts,
  useDeleteSelectedAssets,
} from "src/commands/delete-selected-assets";
import { selectAllShortcut, useSelectAll } from "src/commands/select-all";
import {
  openInpFromFsShortcut,
  useOpenInpFromFs,
} from "src/commands/open-inp-from-fs";
import {
  toggleSatelliteShorcut,
  useToggleSatellite,
} from "src/commands/toggle-satellite";
import { useAtomValue } from "jotai";
import { simulationAtom } from "src/state/jotai";
import {
  showSimulationSettingsShortcut,
  useShowSimulationSettings,
} from "src/commands/show-simulation-settings";
import {
  connectCustomersShortcut,
  disconnectCustomersShortcut,
  useConnectCustomerPoints,
  useDisconnectCustomerPoints,
} from "src/commands/customer-point-actions";
import {
  redrawModeShortcut,
  useSetRedrawMode,
} from "src/commands/set-redraw-mode";
import { reverseLinkShortcut, useReverseLink } from "src/commands/reverse-link";
import {
  toggleNetworkReviewShortcut,
  useToggleNetworkReview,
} from "src/commands/toggle-network-review";
import {
  toggleSidePanelShortcut,
  useToggleSidePanel,
} from "src/commands/toggle-side-panel";
import {
  useCycleSelectionMode,
  selectionModeShortcut,
} from "src/commands/set-area-selection-mode";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

const IGNORE_ROLES = new Set(["menuitem"]);

export const CommandShortcuts = () => {
  const showReport = useShowReport();
  const runSimulation = useRunSimulation();
  const showShortcuts = useShowShortcuts();
  const createNew = useNewProject();
  const openInpFromFs = useOpenInpFromFs();
  const saveInp = useSaveInp();
  const { undo, redo } = useHistoryControl();
  const userTracking = useUserTracking();
  const setDrawingMode = useDrawingMode();
  const deleteSelectedAssets = useDeleteSelectedAssets();
  const selectAll = useSelectAll();
  const toggleSatellite = useToggleSatellite();
  const showSimulationSettings = useShowSimulationSettings();
  const connectCustomerPoints = useConnectCustomerPoints();
  const disconnectCustomerPoints = useDisconnectCustomerPoints();
  const setRedrawMode = useSetRedrawMode();
  const reverseLinkAction = useReverseLink();
  const simulation = useAtomValue(simulationAtom);
  const toggleNetworkReview = useToggleNetworkReview();
  const toggleSidePanel = useToggleSidePanel();
  const cycleSelectionMode = useCycleSelectionMode();

  const isAreaSelectionEnabled = useFeatureFlag("FLAG_LASSO_SELECTION");

  useHotkeys(
    showReportShorcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();
      if (simulation.status === "idle") return;

      void showReport({ source: "shortcut" });
    },
    [showReportShorcut, showReport],
    "Show report",
  );

  useHotkeys(
    runSimulationShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "simulation.executed",
        source: "shortcut",
      });
      void runSimulation();
    },
    [runSimulationShortcut, runSimulation],
    "Run simulation",
  );

  useHotkeys(
    openInpFromFsShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      void openInpFromFs({ source: "shortcut" });
    },
    [openInpFromFsShortcut, openInpFromFs],
    "Open inp",
  );

  useHotkeys(
    createNewShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      void createNew({ source: "shortcut" });
    },
    [createNewShortcut, createNew],
    "Open inp",
  );

  useHotkeys(
    saveShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      void saveInp({ source: "shortcut" });
    },
    [saveShortcut, saveInp],
    "Save",
  );

  useHotkeys(
    saveAsShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      void saveInp({ source: "shortcut", isSaveAs: true });
    },
    [saveAsShortcut, saveInp],
    "Save",
  );

  useHotkeys(
    undoShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "operation.undone",
        source: "shortcut",
      });
      void undo();
    },
    [undoShortcut, undo],
    "Undo",
  );

  useHotkeys(
    redoShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "operation.redone",
        source: "shortcut",
      });
      void redo();
    },
    [redoShortcut, redo],
    "Redo",
  );

  useHotkeys(
    redoShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "operation.redone",
        source: "shortcut",
      });
      void redo();
    },
    [redoShortcut, redo],
    "Redo",
  );

  useHotkeys(
    showSortcutsShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "shortcuts.opened",
        source: "shortcut",
      });
      void showShortcuts();
    },
    [showSortcutsShortcut, showShortcuts],
    "Show shortcuts",
  );

  useHotkeys(
    deleteSelectedShortcuts,
    (e) => {
      if (IGNORE_ROLES.has((e.target as HTMLElement).getAttribute("role")!))
        return;

      e.preventDefault();
      void deleteSelectedAssets({ source: "shortcut" });
    },
    [deleteSelectedAssets],
    "DELETE",
  );

  useHotkeys(
    selectAllShortcut,
    (e) => {
      e.preventDefault();
      void selectAll({ source: "shortcut" });
    },
    [selectAll],
    "SELECT_ALL",
  );

  useHotkeys(
    toggleSatelliteShorcut,
    (e) => {
      e.preventDefault();
      userTracking.capture({
        name: "satelliteView.toggled",
        source: "shortcut",
      });
      toggleSatellite();
    },
    [toggleSatellite],
    `Toggle satellite`,
  );

  useHotkeys(
    showSimulationSettingsShortcut,
    (e) => {
      e.preventDefault();
      showSimulationSettings({ source: "shortcut" });
    },
    [showSimulationSettings],
    `Show simulaton settings`,
  );

  useHotkeys(
    connectCustomersShortcut,
    (e) => {
      e.preventDefault();
      connectCustomerPoints({ source: "shortcut" });
    },
    [connectCustomerPoints],
    "Connect/Reconnect customer points",
  );

  useHotkeys(
    disconnectCustomersShortcut,
    (e) => {
      e.preventDefault();
      disconnectCustomerPoints({ source: "shortcut" });
    },
    [disconnectCustomerPoints],
    "Disconnect customer points",
  );

  useHotkeys(
    redrawModeShortcut,
    (e) => {
      e.preventDefault();
      setRedrawMode({ source: "shortcut" });
    },
    [setRedrawMode],
    "Set redraw mode",
  );

  useHotkeys(
    reverseLinkShortcut,
    (e) => {
      e.preventDefault();
      reverseLinkAction({ source: "shortcut" });
    },
    [reverseLinkAction],
    "Reverse link",
  );

  useHotkeys(
    toggleNetworkReviewShortcut,
    (e) => {
      e.preventDefault();
      toggleNetworkReview({ source: "shortcut" });
    },
    [toggleNetworkReview],
    "Toggle network review",
  );

  useHotkeys(
    toggleSidePanelShortcut,
    (e) => {
      e.preventDefault();
      toggleSidePanel({ source: "shortcut" });
    },
    [toggleSidePanel],
    "Toggle side panel",
  );

  useHotkeys(
    selectionModeShortcut,
    (e) => {
      e.preventDefault();
      const mode = cycleSelectionMode();
      userTracking.capture({
        name: "drawingMode.enabled",
        source: "shortcut",
        type: MODE_INFO[mode as Mode].name,
      });
    },
    [cycleSelectionMode],
    "Cycle selection mode",
    !isAreaSelectionEnabled,
  );

  for (const [mode, shortcut] of Object.entries(drawingModeShorcuts)) {
    // eslint-disable-next-line
    useHotkeys(
      shortcut,
      (e) => {
        if (e.preventDefault) e.preventDefault();

        userTracking.capture({
          name: "drawingMode.enabled",
          source: "shortcut",
          type: MODE_INFO[mode as Mode].name,
        });
        void setDrawingMode(mode as Mode);
      },
      [shortcut, mode, setDrawingMode],
      `Set ${mode} mode`,
    );
  }

  return null;
};
