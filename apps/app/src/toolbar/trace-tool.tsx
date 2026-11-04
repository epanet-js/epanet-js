import {
  BoundaryTraceIcon,
  UpstreamTraceIcon,
  DownstreamTraceIcon,
} from "src/icons";
import { Mode, lastTraceSelectModeAtom } from "src/state/mode";
import { useTranslate } from "src/hooks/use-translate";
import {
  traceSelectModeShortcut,
  useCycleTraceSelectMode,
} from "src/commands/set-trace-select-mode";
import { ToolWithOptions } from "./tool-with-options";

export const TraceTool = () => {
  const translate = useTranslate();
  const cycleTraceSelectMode = useCycleTraceSelectMode();

  return (
    <ToolWithOptions
      label={translate("traceSelection.tool")}
      shortcut={traceSelectModeShortcut}
      lastModeAtom={lastTraceSelectModeAtom}
      cycleMode={cycleTraceSelectMode}
      options={[
        {
          mode: Mode.BOUNDARY_TRACE_SELECT,
          label: translate("traceSelection.boundary"),
          Icon: BoundaryTraceIcon,
        },
        {
          mode: Mode.UPSTREAM_TRACE_SELECT,
          label: translate("traceSelection.upstream"),
          Icon: UpstreamTraceIcon,
        },
        {
          mode: Mode.DOWNSTREAM_TRACE_SELECT,
          label: translate("traceSelection.downstream"),
          Icon: DownstreamTraceIcon,
        },
      ]}
    />
  );
};
