import { memo, useCallback, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { TabRoot, TabList, Tab } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { CloseIcon } from "src/icons";
import { splitsAtom } from "src/state/layout";
import {
  bottomActiveTabAtom,
  effectiveZone,
  panelRegistryAtom,
} from "src/state/panel-layout";
import { useExitProfileViewMode } from "src/commands/exit-profile-view-mode";
import { useCloseProfileView } from "src/commands/close-profile-view";
import { useUserTracking } from "src/infra/user-tracking";

export const BottomZoneTabs = memo(function BottomZoneTabsInner() {
  const panels = useAtomValue(panelRegistryAtom);
  const { layout } = useAtomValue(splitsAtom);
  const translate = useTranslate();
  const [activeTabId, setActiveTabId] = useAtom(bottomActiveTabAtom);
  const exitProfileViewMode = useExitProfileViewMode();
  const closeProfileView = useCloseProfileView();
  const userTracking = useUserTracking();

  const resolvedLayout = layout === "VERTICAL" ? "vertical" : "horizontal";

  const visiblePanels = useMemo(
    () =>
      panels.filter(
        (p) =>
          effectiveZone(p, resolvedLayout) === "bottom" && p.shown !== false,
      ),
    [panels, resolvedLayout],
  );

  const effectiveTabId =
    visiblePanels.find((p) => p.id === activeTabId)?.id ??
    visiblePanels[0]?.id ??
    null;

  const ActivePanel =
    visiblePanels.find((p) => p.id === effectiveTabId)?.component ?? null;

  const handleTabChange = useCallback(
    (newTabId: string) => {
      if (effectiveTabId === "profile-view" && newTabId !== "profile-view") {
        exitProfileViewMode();
      }
      if (newTabId !== effectiveTabId) {
        userTracking.capture({
          name: "bottomPanel.tabSwitched",
          tabId: newTabId,
        });
      }
      setActiveTabId(newTabId);
    },
    [effectiveTabId, exitProfileViewMode, setActiveTabId, userTracking],
  );

  if (visiblePanels.length === 0 || !ActivePanel) return null;

  return (
    <TabRoot
      value={effectiveTabId ?? undefined}
      onValueChange={handleTabChange}
      className="absolute inset-0 flex flex-col"
    >
      <TabList>
        {visiblePanels.map((p) => (
          <Tab key={p.id} value={p.id}>
            <span className="inline-flex items-center gap-2">
              {translate(p.labelKey)}
              {p.id === "profile-view" && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={translate("profileView.close")}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeProfileView({ source: "tab" });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      closeProfileView({ source: "tab" });
                    }
                  }}
                  className="inline-flex items-center justify-center rounded
                    text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                    focus:outline-hidden focus-visible:ring-1 focus-visible:ring-purple-500"
                >
                  <CloseIcon size="sm" />
                </span>
              )}
            </span>
          </Tab>
        ))}
      </TabList>
      <div className="flex-1 min-h-0 flex flex-col relative">
        <DefaultErrorBoundary>
          <ActivePanel />
        </DefaultErrorBoundary>
      </div>
    </TabRoot>
  );
});
