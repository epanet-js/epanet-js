import { useHotkeys } from "src/keyboard/hotkeys";
import { showReportShorcut, useShowReport } from "src/commands/show-report";
import { useUserTracking } from "src/infra/user-tracking";

export const CommandShortcuts = () => {
  const showReport = useShowReport();
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

  return null;
};
