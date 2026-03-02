import { memo } from "react";
import * as T from "@radix-ui/react-tooltip";
import { useAtom } from "jotai";
import clsx from "clsx";
import { splitsAtom, LeftPanelId } from "src/state/jotai";
import { TContent } from "src/components/elements";
import {
  ConnectivityTraceIcon,
  RectangularSelectionIcon,
  GlobeIcon,
  ScenarioIcon,
} from "src/icons";

export const ACTIVITY_BAR_WIDTH = 44;

const PANELS: { id: LeftPanelId; label: string; icon: React.ReactNode }[] = [
  {
    id: "networkReview",
    label: "Network Review",
    icon: <ConnectivityTraceIcon />,
  },
  { id: "selection", label: "Selection", icon: <RectangularSelectionIcon /> },
  { id: "themes", label: "Themes", icon: <GlobeIcon /> },
  { id: "scenarios", label: "Scenarios", icon: <ScenarioIcon /> },
];

export const ActivityBar = memo(function ActivityBarInner() {
  const [splits, setSplits] = useAtom(splitsAtom);

  const handleClick = (panelId: LeftPanelId) => {
    setSplits((s) => {
      if (s.leftOpen && s.activeLeftPanel === panelId) {
        return { ...s, leftOpen: false };
      }
      return { ...s, leftOpen: true, activeLeftPanel: panelId };
    });
  };

  return (
    <div
      style={{ width: ACTIVITY_BAR_WIDTH }}
      className="flex-none flex flex-col bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-black"
    >
      {PANELS.map((panel) => {
        const isActive = splits.leftOpen && splits.activeLeftPanel === panel.id;
        return (
          <T.Root key={panel.id} delayDuration={200}>
            <T.Trigger asChild>
              <button
                type="button"
                onClick={() => handleClick(panel.id)}
                aria-label={panel.label}
                aria-pressed={isActive}
                className={clsx(
                  "flex items-center justify-center w-full focus:outline-none",
                  "border-l-2 transition-colors",
                  isActive
                    ? "border-purple-600 text-black dark:text-white bg-white dark:bg-gray-800"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800",
                )}
                style={{ height: ACTIVITY_BAR_WIDTH }}
              >
                {panel.icon}
              </button>
            </T.Trigger>
            <T.Portal>
              <TContent side="right">
                <span className="whitespace-nowrap">{panel.label}</span>
              </TContent>
            </T.Portal>
          </T.Root>
        );
      })}
    </div>
  );
});
