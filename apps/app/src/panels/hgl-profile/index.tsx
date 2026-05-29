"use client";
import { memo, useEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { hglProfileAtom } from "src/state/hgl-profile";
import { useUserTracking } from "src/infra/user-tracking";
import { useHglProfileData, HglProfileData } from "./chart-data";
import { ChartContainer } from "./chart-container";

export const HglProfilePanel = memo(function HglProfilePanel() {
  const data = useHglProfileData();
  const snapshot = useAtomValue(hglProfileAtom);
  const userTracking = useUserTracking();
  const previousPhaseRef = useRef<HglProfileData["phase"] | null>(null);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = data.phase;
    if (data.phase === "pathBroken" && previousPhase !== "pathBroken") {
      userTracking.capture({
        name: "profileView.pathBroken",
        anchorCount: snapshot?.anchors.length ?? 0,
      });
    }
  }, [data.phase, snapshot, userTracking]);

  const showChart = data.phase === "showingProfile" && data.points.length > 0;

  const pathIds = useMemo(
    () => [
      ...data.points.map((p) => p.nodeId),
      ...data.links.map((l) => l.linkId),
    ],
    [data.points, data.links],
  );

  return (
    <div className="absolute inset-0 flex flex-col bg-popover">
      <div className="flex-1 min-h-0">
        {showChart ? (
          <ChartContainer key={snapshot?.id} data={data} pathIds={pathIds} />
        ) : (
          <ProfileEmptyState phase={data.phase} />
        )}
      </div>
    </div>
  );
});

const ProfileEmptyState = ({ phase }: { phase: HglProfileData["phase"] }) => {
  const translate = useTranslate();

  const message =
    phase === "pathBroken"
      ? translate("hglProfile.empty.pathBroken")
      : phase === "selectingStart"
        ? translate("hglProfile.empty.selectingStart")
        : phase === "selectingEnd"
          ? translate("hglProfile.empty.selectingEnd")
          : translate("hglProfile.empty.noData");

  return (
    <div className="h-full flex items-center justify-center text-subtle text-size-small px-4 text-center">
      {message}
    </div>
  );
};
