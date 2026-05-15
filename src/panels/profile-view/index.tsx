"use client";
import { memo, useEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { useTranslate } from "src/hooks/use-translate";
import { profileViewAtom } from "src/state/profile-view";
import { useUserTracking } from "src/infra/user-tracking";
import { useProfileViewData, ProfileViewData } from "./chart-data";
import { ChartContainer } from "./chart-container";

export const ProfileViewPanel = memo(function ProfileViewPanel() {
  const data = useProfileViewData();
  const snapshot = useAtomValue(profileViewAtom);
  const userTracking = useUserTracking();
  const previousPhaseRef = useRef<ProfileViewData["phase"] | null>(null);

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
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-800">
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

const ProfileEmptyState = ({ phase }: { phase: ProfileViewData["phase"] }) => {
  const translate = useTranslate();

  const message =
    phase === "pathBroken"
      ? translate("profileView.empty.pathBroken")
      : phase === "selectingStart"
        ? translate("profileView.empty.selectingStart")
        : phase === "selectingEnd"
          ? translate("profileView.empty.selectingEnd")
          : translate("profileView.empty.noData");

  return (
    <div className="h-full flex items-center justify-center text-gray-400 text-xs px-4 text-center">
      {message}
    </div>
  );
};
