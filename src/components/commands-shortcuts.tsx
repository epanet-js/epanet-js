import { useHotkeys } from "src/keyboard/hotkeys";
import { showReportShorcut, useShowReport } from "src/commands/show-report";
import { useUserTracking } from "src/infra/user-tracking";
import {
  runSimulationShortcut,
  useRunSimulation,
} from "src/commands/run-simulation";
import { openInpShortcut, useOpenInp } from "src/commands/open-inp";

export const CommandShortcuts = () => {
  const showReport = useShowReport();
  const runSimulation = useRunSimulation();
  const { openInpFromFs } = useOpenInp();
  const userTracking = useUserTracking();

  useHotkeys(
    showReportShorcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "report.opened",
        source: "shortcut",
      });
      showReport();
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
      runSimulation();
    },
    [runSimulationShortcut, runSimulation],
    "Run simulation",
  );

  useHotkeys(
    openInpShortcut,
    (e) => {
      if (e.preventDefault) e.preventDefault();

      userTracking.capture({
        name: "openModel.started",
        source: "shortcut",
      });
      openInpFromFs();
    },
    [openInpShortcut, openInpFromFs],
    "Open inp",
  );

  return null;
};
