"use client";
import { memo, useMemo } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useProfileViewData, ProfileViewData } from "./chart-data";
import { ChartContainer } from "./chart-container";

export const ProfileViewPanel = memo(function ProfileViewPanel() {
  const data = useProfileViewData();

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
          <ChartContainer data={data} pathIds={pathIds} />
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
