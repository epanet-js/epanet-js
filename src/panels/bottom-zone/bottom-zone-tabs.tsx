import { memo, useMemo } from "react";
import { useAtom, useAtomValue } from "jotai";
import { TabRoot, TabList, Tab } from "src/components/tab";
import { DefaultErrorBoundary } from "src/components/elements";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { splitsAtom } from "src/state/layout";
import { bottomActiveTabAtom, effectiveZone } from "src/state/panel-layout";
import { panelRegistryAtom } from "src/panels/registry";

export const BottomZoneTabs = memo(function BottomZoneTabsInner() {
  const panels = useAtomValue(panelRegistryAtom);
  const { layout } = useAtomValue(splitsAtom);
  const isProfileViewOn = useFeatureFlag("FLAG_PROFILE_VIEW");
  const translate = useTranslate();
  const [activeTabId, setActiveTabId] = useAtom(bottomActiveTabAtom);

  const resolvedLayout = layout === "VERTICAL" ? "vertical" : "horizontal";

  const visiblePanels = useMemo(
    () =>
      panels.filter((p) => {
        if (p.id === "profile-view" && !isProfileViewOn) return false;
        return (
          effectiveZone(p, resolvedLayout) === "bottom" && p.shown !== false
        );
      }),
    [panels, resolvedLayout, isProfileViewOn],
  );

  const effectiveTabId =
    visiblePanels.find((p) => p.id === activeTabId)?.id ??
    visiblePanels[0]?.id ??
    null;

  const ActivePanel =
    visiblePanels.find((p) => p.id === effectiveTabId)?.component ?? null;

  if (visiblePanels.length === 0 || !ActivePanel) return null;

  return (
    <TabRoot
      value={effectiveTabId ?? undefined}
      onValueChange={setActiveTabId}
      className="absolute inset-0 flex flex-col"
    >
      <TabList>
        {visiblePanels.map((p) => (
          <Tab key={p.id} value={p.id}>
            {translate(p.labelKey)}
          </Tab>
        ))}
      </TabList>
      <div className="flex-1 min-h-0 relative">
        <DefaultErrorBoundary>
          <ActivePanel />
        </DefaultErrorBoundary>
      </div>
    </TabRoot>
  );
});
